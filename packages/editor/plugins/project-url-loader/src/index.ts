import { parseProjectSource } from '@8f4e/compiler';
import type { EditorPlugin, LoadingIndicatorHandle } from '@8f4e/editor-core';
import { EMPTY_DEFAULT_PROJECT, logError } from '@8f4e/editor-state';
import type { ProjectObjectModel } from '@8f4e/language-spec';

export function createProjectUrlLoaderPlugin({
	fetch,
	initialProjectUrl,
	onLoaded,
	onError,
}: {
	fetch: typeof globalThis.fetch;
	initialProjectUrl?: string;
	onLoaded?: () => void;
	onError?: (error: unknown) => void;
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
						indicator.fail();
						logError(store.getState(), `Failed to load project from ${initialProjectUrl}: ${String(error)}`);
						events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
						onError?.(error);
						return;
					}
					events.dispatch('loadProject', { project });
					onLoaded?.();
					indicator.done();
				} catch (error) {
					indicator.fail();
					throw error;
				} finally {
					pendingLoads.delete(indicator);
					indicator.cancel();
				}
			};
			events.on('init', loadInitialProject);
			return () => {
				disposed = true;
				events.off('init', loadInitialProject);
				for (const indicator of pendingLoads) indicator.cancel();
				pendingLoads.clear();
			};
		},
	};
}
