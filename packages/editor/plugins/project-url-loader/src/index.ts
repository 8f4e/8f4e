import { parseProjectSource } from '@8f4e/compiler';
import type { EditorPlugin, LoadingIndicatorHandle } from '@8f4e/editor-core';
import { EMPTY_DEFAULT_PROJECT, logError } from '@8f4e/editor-state';
import type { ProjectObjectModel } from '@8f4e/language-spec';

export function createProjectUrlLoaderPlugin({
	fetch,
	initialProjectUrl,
	failureMode = 'reject',
}: {
	fetch: typeof globalThis.fetch;
	initialProjectUrl?: string;
	/** By default an initial source failure rejects mounting; authoring hosts can recover with an empty project. */
	failureMode?: 'reject' | 'empty-project';
}): EditorPlugin {
	return {
		id: 'project-url-loader',
		setup: ({ store, events, loading }) => {
			let disposed = false;
			const pendingLoads = new Set<LoadingIndicatorHandle>();
			const loadInitialProject = async () => {
				if (!initialProjectUrl || disposed) return;
				const indicator = loading.add({ id: 'project-url', message: 'Loading project...' });
				pendingLoads.add(indicator);
				try {
					let project: ProjectObjectModel;
					try {
						const response = await fetch(initialProjectUrl, { cache: 'no-store' });
						if (!response.ok) throw new Error(`HTTP ${response.status}`);
						const source = await response.text();
						if (disposed) return;
						project = parseProjectSource(source);
					} catch (error) {
						if (disposed) return;
						logError(store.getState(), `Failed to load project from ${initialProjectUrl}: ${String(error)}`);
						if (failureMode === 'reject') throw error;
						indicator.fail();
						events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
						return;
					}
					events.dispatch('loadProject', { project });
					indicator.done();
				} catch (error) {
					indicator.fail();
					throw error;
				} finally {
					pendingLoads.delete(indicator);
					indicator.cancel();
				}
			};
			events.on('prepareInitialProject', loadInitialProject);
			return () => {
				disposed = true;
				events.off('prepareInitialProject', loadInitialProject);
				for (const indicator of pendingLoads) indicator.cancel();
				pendingLoads.clear();
			};
		},
	};
}
