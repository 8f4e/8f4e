import { EventEmitter } from 'node:events';
import initState, { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, vi } from 'vitest';
import { createCodeBlockCopyPastePlugin } from '../index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});
export function setup() {
	const emitter = new EventEmitter();
	const events = {
		on: emitter.on.bind(emitter),
		off: emitter.off.bind(emitter),
		dispatch: emitter.emit.bind(emitter),
		dispatchAsync: async (name: string, payload?: unknown) => {
			for (const handler of emitter.listeners(name)) await handler(payload);
		},
	};
	let clipboard = '';
	const readClipboardText = vi.fn(async () => clipboard);
	const writeClipboardText = vi.fn(async (text: string) => {
		clipboard = text;
	});
	const store = initState(events, { callbacks: {} });
	events.dispatch('loadProject', {
		project: {
			...EMPTY_DEFAULT_PROJECT,
			execution: [
				{
					type: 'module',
					id: 0,
					entry: 'audio',
					code: ['module same', '; @pos 4 3', '; @group audio', 'int value 1', 'moduleEnd'],
				},
			],
		},
	});
	store.set('editorMode', 'edit');
	const dispose = createCodeBlockCopyPastePlugin({ readClipboardText, writeClipboardText }).setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		drawers: createEditorDrawerRegistry(),
	});
	cleanups.push(store.dispose, dispose);
	const state = store.getState();
	const paste = async (text: string, x = 80, y = 64) => {
		clipboard = text;
		await events.dispatchAsync('pasteCodeBlocks', { x, y });
	};
	const openMenu = async (codeBlock?: (typeof state.codeBlockRendering.currentProject.blocks)[number]) => {
		await events.dispatchAsync(
			'contextmenu',
			codeBlock ? { x: codeBlock.x - state.viewport.x + 8, y: codeBlock.y - state.viewport.y + 8 } : { x: 600, y: 300 }
		);
		return state.contextMenu.items;
	};
	return { state, store, events, paste, openMenu, readClipboardText, writeClipboardText, dispose };
}
