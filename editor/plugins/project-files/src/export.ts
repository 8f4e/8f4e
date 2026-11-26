import type { EditorPlugin } from '@8f4e/editor-core';
import { logError } from '@8f4e/editor-state';
import { pickProjectFile, writeProjectFile } from './browser-files';
import { registerExportActions } from './export-actions';
import { createProjectSourceFile } from './project-source-file';

/** Export a fresh copy of the project on every invocation, without a file association. */
export function createProjectExportPlugin({ inputTarget }: { inputTarget: HTMLElement }): EditorPlugin {
	return {
		id: 'project-export',
		setup: context => {
			const document = inputTarget.ownerDocument;
			const onExport = async () => {
				const state = context.store.getState();
				const file = createProjectSourceFile(state);
				if (!file) return;
				try {
					const handle = await pickProjectFile(document, file.fileName);
					if (handle !== null) await writeProjectFile(document, file, handle);
				} catch (error) {
					logError(state, `Failed to save project: ${String(error)}`);
				}
			};
			return registerExportActions(context, inputTarget, onExport, 'exportProject');
		},
	};
}
