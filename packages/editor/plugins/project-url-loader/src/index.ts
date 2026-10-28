import { parseProjectSource } from '@8f4e/compiler';
import type { EditorPlugin } from '@8f4e/editor-core';
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
		setup: ({ store, events }) => {
			let disposed = false;
			const loadInitialProject = async () => {
				if (!initialProjectUrl) return;
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
					events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
					onError?.(error);
					return;
				}
				events.dispatch('loadProject', { project });
				onLoaded?.();
			};
			events.on('init', loadInitialProject);
			return () => {
				disposed = true;
				events.off('init', loadInitialProject);
			};
		},
	};
}
