import type { EditorPlugin } from '@8f4e/editor-core';
import type { ProjectFileHandle } from './browser-files';

export { type FilePickerWindow, isPickerCancellation, type ProjectFileHandle, projectFileType } from './browser-files';
export { writeProjectFile } from './write-project-file';

/** Shared destination and pending write state for one editor's file plugins. */
export function createProjectFileSession() {
	const clearFileAssociation = () => {
		session.generation++;
		session.handle = undefined;
		session.pendingDestination = undefined;
	};
	const session = {
		handle: undefined as ProjectFileHandle | undefined,
		generation: 0,
		writes: Promise.resolve(),
		pendingDestination: undefined as Promise<ProjectFileHandle> | undefined,
		plugin: {
			id: 'project-file-session',
			setup: ({ events }) => {
				events.on('loadProject', clearFileAssociation);
				return () => {
					events.off('loadProject', clearFileAssociation);
					clearFileAssociation();
				};
			},
		} satisfies EditorPlugin,
	};
	return session;
}

export type ProjectFileSession = ReturnType<typeof createProjectFileSession>;
