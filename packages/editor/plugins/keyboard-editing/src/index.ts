import type { EditorPlugin } from '@8f4e/editor-core';
import { logError } from '@8f4e/editor-state';

/** The input bridge is small; text editing loads on the first entry into edit mode. */
export function createKeyboardEditingPlugin({ inputTarget }: { inputTarget: HTMLElement }): EditorPlugin {
	return {
		id: 'keyboard-editing',
		setup: context => {
			const { store } = context;
			let editing: typeof import('./editing') | undefined;
			let loading = false;
			let disposed = false;
			const queued: KeyboardEvent[] = [];
			const load = async () => {
				if (loading || editing) return;
				loading = true;
				try {
					const module = await import('./editing');
					if (disposed) return;
					editing = module;
					// Replay through the input target so independent navigation and mode bindings retain their order.
					for (const event of queued.splice(0)) {
						inputTarget.dispatchEvent(new inputTarget.ownerDocument.defaultView!.KeyboardEvent('keydown', event));
					}
				} catch (error) {
					queued.length = 0;
					if (!disposed) logError(store.getState(), `Failed to load keyboard editing: ${String(error)}`);
				} finally {
					loading = false;
				}
			};
			const onModeChanged = () => {
				if (store.getState().editorMode === 'edit') void load();
				else queued.length = 0;
			};
			const onProjectChange = () => {
				if (store.getState().projectChange.kind === 'replace') queued.length = 0;
			};
			const onKeydown = (event: KeyboardEvent) => {
				if (store.getState().editorMode !== 'edit' || event.defaultPrevented) return;
				if (editing) editing.handleKeydown(event, context);
				else {
					queued.push(event);
					event.preventDefault();
					event.stopImmediatePropagation();
					void load();
				}
			};
			inputTarget.addEventListener('keydown', onKeydown, { capture: true });
			store.subscribe('editorMode', onModeChanged);
			store.subscribe('projectChange', onProjectChange);
			onModeChanged();
			return () => {
				disposed = true;
				queued.length = 0;
				inputTarget.removeEventListener('keydown', onKeydown, { capture: true });
				store.unsubscribe('editorMode', onModeChanged);
				store.unsubscribe('projectChange', onProjectChange);
			};
		},
	};
}
