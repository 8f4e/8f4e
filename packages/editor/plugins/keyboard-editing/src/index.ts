import type { EditorPlugin } from '@8f4e/editor-core';
import { logError } from '@8f4e/editor-state';

/** The input bridge is small; text editing loads on the first entry into edit mode. */
export function createKeyboardEditingPlugin({ inputTarget }: { inputTarget: HTMLElement }): EditorPlugin {
	return {
		id: 'keyboard-editing',
		setup: context => {
			const { store } = context;
			let editing: typeof import('./editing') | undefined;
			const removeCaret = context.drawers.registerCodeBlockForegroundDrawer(drawContext =>
				editing?.drawCaret(drawContext)
			);
			let loading = false;
			let disposed = false;
			let replaying = false;
			const queued: Array<KeyboardEvent | FocusEvent> = [];
			const replay = (event: KeyboardEvent | FocusEvent) => {
				const browser = inputTarget.ownerDocument.defaultView!;
				replaying = true;
				try {
					inputTarget.dispatchEvent(
						event.type === 'blur'
							? new browser.FocusEvent('blur', event as FocusEvent)
							: new browser.KeyboardEvent(event.type, event as KeyboardEvent)
					);
				} finally {
					replaying = false;
				}
			};
			const discardInput = () => {
				// Releases may belong to keys pressed before editing started. Deliver them even when typing is discarded.
				for (const event of queued.splice(0)) if (event.type !== 'keydown') replay(event);
			};
			const load = async () => {
				if (loading || editing) return;
				loading = true;
				try {
					const module = await import('./editing');
					if (disposed) return;
					editing = module;
					// Replay through the input target so independent navigation and mode bindings retain their order.
					for (const event of queued.splice(0)) replay(event);
				} catch (error) {
					discardInput();
					if (!disposed) logError(store.getState(), `Failed to load keyboard editing: ${String(error)}`);
				} finally {
					loading = false;
				}
			};
			const onModeChanged = () => {
				if (store.getState().editorMode === 'edit') void load();
				else discardInput();
			};
			const onProjectChange = () => {
				if (store.getState().projectChange.kind === 'replace') discardInput();
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
			const onPendingRelease = (event: KeyboardEvent | FocusEvent) => {
				if (replaying || !loading || editing || store.getState().editorMode !== 'edit') return;
				queued.push(event);
				event.stopImmediatePropagation();
			};
			const onPaste = (event: ClipboardEvent) => editing?.handlePaste(event, context);
			inputTarget.addEventListener('keydown', onKeydown, { capture: true });
			inputTarget.addEventListener('paste', onPaste);
			inputTarget.addEventListener('keyup', onPendingRelease, { capture: true });
			inputTarget.addEventListener('blur', onPendingRelease, { capture: true });
			store.subscribe('editorMode', onModeChanged);
			store.subscribe('projectChange', onProjectChange);
			onModeChanged();
			return () => {
				disposed = true;
				discardInput();
				removeCaret();
				inputTarget.removeEventListener('keydown', onKeydown, { capture: true });
				inputTarget.removeEventListener('paste', onPaste);
				inputTarget.removeEventListener('keyup', onPendingRelease, { capture: true });
				inputTarget.removeEventListener('blur', onPendingRelease, { capture: true });
				store.unsubscribe('editorMode', onModeChanged);
				store.unsubscribe('projectChange', onProjectChange);
			};
		},
	};
}
