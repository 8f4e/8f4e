import { EventEmitter } from 'node:events';
import type { EditorPlugin } from '@8f4e/editor-core';
import initState, { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach } from 'vitest';

class TestKeyboardEvent extends Event {
	key: string;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
	constructor(type: string, options: KeyboardEventInit = {}) {
		super(type, { cancelable: true });
		this.key = options.key ?? '';
		this.ctrlKey = options.ctrlKey ?? false;
		this.metaKey = options.metaKey ?? false;
		this.altKey = options.altKey ?? false;
		this.shiftKey = options.shiftKey ?? false;
	}
}
const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

export function setup(
	createPlugin: (options: { inputTarget: HTMLElement }) => EditorPlugin,
	mode: 'view' | 'edit' = 'edit'
) {
	const inputTarget = Object.assign(new EventTarget(), {
		ownerDocument: { defaultView: { KeyboardEvent: TestKeyboardEvent } },
	}) as unknown as HTMLElement;
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {}, featureFlags: { historyTracking: true } });
	events.dispatch('loadProject', {
		project: {
			...EMPTY_DEFAULT_PROJECT,
			execution: [{ type: 'module', id: 0, entry: 'main', code: ['module main', 'push 1', 'drop', 'moduleEnd'] }],
		},
	});
	store.set('editorMode', mode);
	const state = store.getState();
	const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'main')!;
	store.set('codeBlockRendering.selectedCodeBlock', block);
	block.cursor = { row: 1, col: 6, y: 0 };
	const disposePlugin = createPlugin({ inputTarget }).setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		drawers: createEditorDrawerRegistry(),
	});
	cleanups.push(store.dispose, disposePlugin);
	const key = (key: string, options: KeyboardEventInit = {}) => {
		const event = new TestKeyboardEvent('keydown', { key, ...options });
		inputTarget.dispatchEvent(event);
		return event;
	};
	return { inputTarget, state, store, events, block, key, disposePlugin };
}
