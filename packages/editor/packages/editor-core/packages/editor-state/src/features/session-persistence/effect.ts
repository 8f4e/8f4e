import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import serializeToProject from '../../pureHelpers/projectSerialization/serializeToProject';

export default function sessionPersistence(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();
	async function onSaveSession() {
		if (!state.callbacks.saveSession) return;
		await state.callbacks.saveSession(serializeToProject(state));
		if (state.callbacks.getStorageQuota) {
			store.set('storageQuota', await state.callbacks.getStorageQuota());
		}
	}

	store.subscribe('codeBlockRendering.codeBlocks', onSaveSession);
	store.subscribe('codeBlockRendering.selectedCodeBlock.code', onSaveSession);
	store.subscribe('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', onSaveSession);
	events.on('saveSession', onSaveSession);
	return () => {
		store.unsubscribe('codeBlockRendering.codeBlocks', onSaveSession);
		store.unsubscribe('codeBlockRendering.selectedCodeBlock.code', onSaveSession);
		store.unsubscribe('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', onSaveSession);
		events.off('saveSession', onSaveSession);
	};
}
