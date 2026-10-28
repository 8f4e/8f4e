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
			const load = async ({ projectUrl }: { projectUrl: string }) => {
				let project: ProjectObjectModel;
				try {
					const response = await fetch(projectUrl, { cache: 'no-store' });
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const source = await response.text();
					if (disposed) return;
					project = parseProjectSource(source);
				} catch (error) {
					if (disposed) return;
					logError(store.getState(), `Failed to load project from ${projectUrl}: ${String(error)}`);
					project = EMPTY_DEFAULT_PROJECT;
				}
				events.dispatch('loadProject', { project });
			};
			const loadInitialProject = () => {
				if (initialProjectUrl) void load({ projectUrl: initialProjectUrl });
			};
			events.on('init', loadInitialProject);
			events.on('loadProjectByUrl', load);
			return () => {
				disposed = true;
				events.off('init', loadInitialProject);
				events.off('loadProjectByUrl', load);
			};
		},
	};
}
