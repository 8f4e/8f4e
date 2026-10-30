import type { EditorPlugin } from '@8f4e/editor-core';

export type ProjectFileHandle = FileSystemFileHandle & {
	requestPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
};

/** Shared file association for one editor's Open and Save plugins. */
export function createProjectFileSession() {
	const clearFileAssociation = () => {
		session.handle = undefined;
	};
	const session = {
		handle: undefined as ProjectFileHandle | undefined,
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
