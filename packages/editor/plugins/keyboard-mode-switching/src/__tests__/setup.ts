import { EventEmitter } from 'node:events';
import initState from '@8f4e/editor-state';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach } from 'vitest';
import { createKeyboardModeSwitchingPlugin } from '../index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

export function setup(mode: 'view' | 'edit' = 'view') {
	const inputTarget = new EventTarget() as HTMLElement;
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	store.set('editorMode', mode);
	const drawers = createEditorDrawerRegistry();
	const disposePlugin = createKeyboardModeSwitchingPlugin({ inputTarget }).setup({
		store,
		events,
		drawers,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
	});
	cleanups.push(store.dispose, disposePlugin);
	const key = (key: string, options: KeyboardEventInit = {}) => {
		const event = Object.assign(new Event('keydown', { cancelable: true }), { key, ...options });
		inputTarget.dispatchEvent(event);
		return event;
	};
	return { state: store.getState(), drawCanvasOverlays: drawers.drawCanvasOverlays, key, disposePlugin };
}
