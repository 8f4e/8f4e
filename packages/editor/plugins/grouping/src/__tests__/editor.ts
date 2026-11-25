import { parseProjectSource } from '@8f4e/compiler';
import { undoRedoPlugin } from '@8f4e/editor-plugin-undo-redo';
import initState, { setGridSize } from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import { createEditorRenderRegistry } from '@8f4e/web-ui';
import { vi } from 'vitest';
import { createGroupingPlugin } from '../index';
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
	const writeClipboardText = vi.fn(async (_text: string) => {});
	const store = initState(events, { callbacks: {} });
	setGridSize(store.getState(), events, TEST_GRID_SIZE);

	events.dispatch(mode === 'edit' ? 'enterEditMode' : 'exitToViewMode');
	const context = {
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		renderRegistry: createEditorRenderRegistry(),
	};
	const disposeHistory = undoRedoPlugin.setup(context);
	const disposePlugin = installed ? createGroupingPlugin({ writeClipboardText }).setup(context) : () => {};
	events.dispatch('loadProject', { project: parseProjectSource(code) });
	events.dispatch(mode === 'edit' ? 'enterEditMode' : 'exitToViewMode');
	const state = store.getState();
	const block = (name: string) => state.project.activeLevel.blocks.find(candidate => candidate.name === name)!;
	const openMenu = async (target: EditorCodeBlock = block('first')) => {
		events.dispatch('contextmenu', { x: target.x - state.viewport.x + 8, y: target.y - state.viewport.y + 8 });
		await Promise.resolve();
		return state.contextMenu.items;
	};
	const startDrag = (target: EditorCodeBlock, altKey = false, dx = state.viewport.vGrid, dy = state.viewport.hGrid) => {
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
		events.dispatch('pointerdown', pointer);
		events.dispatch('pointermove', { ...pointer, movementX: dx, movementY: dy });
	};
	const drag = (target: EditorCodeBlock, altKey = false, dx = state.viewport.vGrid, dy = state.viewport.hGrid) => {
		startDrag(target, altKey, dx, dy);
		events.dispatch('pointerup');
	};
	return {
		store,
		state,
		events,
		block,
		openMenu,
		startDrag,
		drag,
		writeClipboardText,
		disposePlugin,
		dispose: () => {
			disposePlugin();
			disposeHistory();
			store.dispose();
		},
	};
}
