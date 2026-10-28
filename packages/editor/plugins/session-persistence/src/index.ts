import type { EditorPlugin } from '@8f4e/editor-core';
import { logError, serializeToProject } from '@8f4e/editor-state';
import type { ProjectObjectModel } from '@8f4e/language-spec';

export function createSessionPersistencePlugin({
	storage,
	storageKey,
	restoreOnStartup,
}: {
	storage: Pick<Storage, 'getItem' | 'setItem'>;
	storageKey: string;
	restoreOnStartup: boolean;
}): EditorPlugin {
	return {
		id: 'session-persistence',
		setup: ({ store, events }) => {
			const state = store.getState();
			let savedProject: ProjectObjectModel | null = null;
			if (restoreOnStartup) {
				try {
					const saved = storage.getItem(storageKey);
					if (saved !== null) savedProject = JSON.parse(saved);
				} catch (error) {
					logError(state, `Failed to restore editor session: ${String(error)}`);
				}
			}
			const restore = () => {
				if (savedProject !== null) events.dispatch('loadProject', { project: savedProject });
			};
			const save = () => {
				const saved = JSON.stringify(serializeToProject(state));
				try {
					storage.setItem(storageKey, saved);
				} catch (error) {
					logError(state, `Failed to save editor session: ${String(error)}`);
				}
			};
			store.subscribe('codeBlockRendering.codeBlocks', save);
			store.subscribe('codeBlockRendering.selectedCodeBlock.code', save);
			store.subscribe('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', save);
			events.on('init', restore);
			events.on('saveSession', save);
			return () => {
				store.unsubscribe('codeBlockRendering.codeBlocks', save);
				store.unsubscribe('codeBlockRendering.selectedCodeBlock.code', save);
				store.unsubscribe('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', save);
				events.off('init', restore);
				events.off('saveSession', save);
			};
		},
	};
}
