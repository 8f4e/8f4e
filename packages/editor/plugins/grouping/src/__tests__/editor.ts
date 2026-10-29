import { parseProjectSource } from '@8f4e/compiler';
import initState from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { vi } from 'vitest';
import { groupingPlugin } from '../index';
import { createEvents } from './events';

export const source = `8f4e/v1
constants env
; @pos 120 60
constantsEnd
entry main
module first
; @pos 4 3
; @group audio
int value 1
moduleEnd
module second
; @pos 32 10
; @group audio
int value 2
moduleEnd
module other
; @pos 60 20
; @group video
int value 3
moduleEnd
entryEnd`;

export function setup({ code = source, installed = true, mode = 'edit' as 'edit' | 'view' } = {}) {
	const events = createEvents();
	let clipboard = '';
	const writeClipboardText = vi.fn(async (text: string) => {
		clipboard = text;
	});
	const store = initState(events, {
		callbacks: { readClipboardText: async () => clipboard, writeClipboardText },
		initialEditorMode: mode,
	});
	const disposePlugin = installed
		? groupingPlugin.setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				drawers: createCodeBlockDrawerRegistry(),
			})
		: () => {};
	events.dispatch('loadProject', { project: parseProjectSource(code) });
	const state = store.getState();
	const block = (name: string) => state.codeBlockRendering.codeBlocks.find(candidate => candidate.name === name)!;
	const openMenu = async (target: CodeBlockGraphicData = block('first')) => {
		events.dispatch('contextmenu', { x: target.x - state.viewport.x + 8, y: target.y - state.viewport.y + 8 });
		await Promise.resolve();
		return state.contextMenu.items;
	};
	const drag = (target: CodeBlockGraphicData, altKey = false, dx = state.viewport.vGrid, dy = state.viewport.hGrid) => {
		const pointer = {
			x: target.x - state.viewport.x + 8,
			y: target.y - state.viewport.y + 8,
			altKey,
			stopPropagation: false,
			canvasWidth: 1024,
			canvasHeight: 768,
			buttons: 1,
			movementX: 0,
			movementY: 0,
		};
		events.dispatch('mousedown', pointer);
		events.dispatch('mousemove', { ...pointer, movementX: dx, movementY: dy });
		events.dispatch('mouseup');
	};
	const paste = async (text: string) => {
		clipboard = text;
		events.dispatch('pasteCodeBlocks', { x: 20, y: 20 });
		await Promise.resolve();
	};
	return {
		store,
		state,
		events,
		block,
		openMenu,
		drag,
		paste,
		writeClipboardText,
		disposePlugin,
		dispose: () => {
			disposePlugin();
			store.dispose();
		},
	};
}
