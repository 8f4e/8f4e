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
			const save = () => {
				const saved = JSON.stringify(serializeToProject(state));
				try {
					storage.setItem(storageKey, saved);
				} catch (error) {
					logError(state, `Failed to save editor session: ${String(error)}`);
				}
			};
			const initialize = () => {
				let restoreFailed = false;
				if (restoreOnStartup) {
					try {
						const saved = storage.getItem(storageKey);
						if (saved !== null) {
							const project: ProjectObjectModel | null = JSON.parse(saved);
							if (project !== null) events.dispatch('loadProject', { project });
						}
					} catch (error) {
						restoreFailed = true;
						logError(state, `Failed to restore editor session: ${String(error)}`);
					}
				}

				store.subscribe('projectChange', save);
				if (!restoreFailed) save();
			};
			events.on('prepareInitialProject', initialize);
			return () => {
				events.off('prepareInitialProject', initialize);
				store.unsubscribe('projectChange', save);
			};
		},
	};
}
