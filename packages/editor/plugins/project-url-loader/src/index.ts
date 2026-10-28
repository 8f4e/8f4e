import { parseProjectSource } from '@8f4e/compiler';
import type { EditorPlugin } from '@8f4e/editor-core';
import { EMPTY_DEFAULT_PROJECT, logError } from '@8f4e/editor-state';
import type { ProjectObjectModel } from '@8f4e/language-spec';

export function createProjectUrlLoaderPlugin({
	fetch,
	initialProjectUrl,
}: {
	fetch: typeof globalThis.fetch;
	initialProjectUrl?: string;
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
					project = EMPTY_DEFAULT_PROJECT;
				}
				events.dispatch('loadProject', { project });
			};
			events.on('init', loadInitialProject);
			return () => {
				disposed = true;
				events.off('init', loadInitialProject);
			};
		},
	};
}
