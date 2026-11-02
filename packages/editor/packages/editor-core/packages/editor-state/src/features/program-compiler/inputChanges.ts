import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

/** Announce completed input mutations without selecting or invoking a compiler. */
export default function publishCompilationInputChanges(
	store: StateManager<State>,
	events: EventDispatcher
): () => void {
	const announce = () => events.dispatch('compilationInputChanged');
	store.subscribe('compilerInputRevision', announce);
	return () => store.unsubscribe('compilerInputRevision', announce);
}
