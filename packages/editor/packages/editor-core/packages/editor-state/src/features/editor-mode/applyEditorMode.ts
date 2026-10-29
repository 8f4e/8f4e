import type { EditorMode, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

export default function applyEditorMode(store: Pick<StateManager<State>, 'set'>, mode: EditorMode): void {
	store.set('editorMode', mode);
	store.set('featureFlags.editing', mode === 'edit');
	store.set('featureFlags.codeLineSelection', true);
}
