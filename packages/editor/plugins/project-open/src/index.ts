import { parseProjectSource } from '@8f4e/compiler';
import type { EditorPlugin } from '@8f4e/editor-core';
import type { ProjectFileHandle, ProjectFileSession } from '@8f4e/editor-file-session';
import { logError } from '@8f4e/editor-state';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import { openProjectFile } from './open-project-file';

export function createProjectOpenPlugin({
	document,
	fileSession,
	showOpenMenuItem = true,
}: {
	document: Document;
	fileSession: ProjectFileSession;
	showOpenMenuItem?: boolean;
}): EditorPlugin {
	return {
		id: 'project-open',
		setup: ({ store, events, menus }) => {
			const state = store.getState();
			let disposed = false;
			const unregisterOpen = menus.registerItem('mainMenu', () =>
				showOpenMenuItem ? { title: 'Open From Disk', action: 'importProject', close: true } : undefined
			);
			const onImport = async () => {
				let project: ProjectObjectModel;
				let handle: ProjectFileHandle | undefined;
				try {
					const opened = await openProjectFile(document);
					if (!opened) return;
					project = parseProjectSource(await opened.file.text());
					handle = opened.handle;
				} catch (error) {
					if (disposed || (error instanceof Error && error.name === 'AbortError')) return;
					logError(state, `Failed to open project: ${String(error)}`);
					return;
				}
				if (disposed) return;
				events.dispatch('loadProject', { project });
				fileSession.handle = handle;
			};
			events.on('importProject', onImport);
			return () => {
				disposed = true;
				events.off('importProject', onImport);
				unregisterOpen();
			};
		},
	};
}
