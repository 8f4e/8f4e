import { EventEmitter } from 'node:events';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState, { setGridSize } from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { CodeBlockPointerDownEvent, EditorCodeBlock, InternalPointerEvent } from '@8f4e/editor-state-types';
import { parseProjectSource } from '@8f4e/project-preparser';
import { createEditorRenderRegistry, type DrawContext, type MemoryViews, textToGlyphIds } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { enterGroupButtonPlugin } from './index';

const source = `8f4e/v1
constants env
; @pos 100 100
constantsEnd
entry main
group outer
; @pos 4 3
; @hide
entry main
group inner
; @pos 4 3
entry main
module child
moduleEnd
entryEnd
groupEnd
entryEnd
groupEnd
module ordinary
; @pos 40 3
moduleEnd
entryEnd`;

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup() {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	setGridSize(store.getState(), events, TEST_GRID_SIZE);
	events.dispatch('loadProject', { project: parseProjectSource(source) });
	const state = store.getState();
	const root = state.project.activeLevel;
	const block = root.blocks.find(block => block.name === 'outer')!;
	const ordinary = root.blocks.find(block => block.name === 'ordinary')!;
	const height = block.height;
	const renderRegistry = createEditorRenderRegistry();
	const dispose = enterGroupButtonPlugin.setup({
		store,
		events,
		layout: store.layout,
		menus: store.menus,
		directives: store.directives,
		loading: store.loading,
		renderRegistry,
	});
	cleanups.push(store.dispose, dispose);
	const drawFill = vi.fn();
	const drawGlyphs = vi.fn();
	const openGroup = vi.fn();
	events.on('openProjectGroup', openGroup);
	const render = (codeBlock = block) => {
		drawFill.mockClear();
		drawGlyphs.mockClear();
		renderRegistry.drawCodeBlock({
			state,
			codeBlock,
			draw: { drawFill, drawGlyphs } as unknown as DrawContext,
			memoryViews: {} as MemoryViews,
		});
	};
	const pointer = (
		codeBlock: EditorCodeBlock,
		overrides: Partial<InternalPointerEvent> = {}
	): InternalPointerEvent => ({
		x: codeBlock.x - state.viewport.x + codeBlock.width / 2,
		y: codeBlock.y - state.viewport.y + 1.5 * state.viewport.hGrid,
		buttons: 1,
		movementX: 0,
		movementY: 0,
		altKey: false,
		stopPropagation: false,
		canvasWidth: state.viewport.width,
		canvasHeight: state.viewport.height,
		...overrides,
	});
	const press = (codeBlock = block, overrides: Partial<InternalPointerEvent> = {}) => {
		const { x, y, buttons } = pointer(codeBlock, overrides);
		const event: CodeBlockPointerDownEvent = {
			x,
			y,
			buttons,
			codeBlock,
			relativeX: x - codeBlock.x + state.viewport.x,
			relativeY: y - codeBlock.y + state.viewport.y,
			stopPropagation: false,
		};
		events.dispatch('codeBlockPointerDown', event);
		return event;
	};
	const release = (codeBlock = block, overrides: Partial<InternalPointerEvent> = {}) => {
		const event = pointer(codeBlock, { buttons: 0, ...overrides });
		events.dispatch('pointerup', event);
		return event;
	};
	return {
		store,
		state,
		events,
		block,
		ordinary,
		height,
		render,
		drawFill,
		drawGlyphs,
		openGroup,
		press,
		release,
		pointer,
		dispose,
	};
}

it('reserves two rows for a centered flat button and half-block shadow, even when folded', () => {
	const test = setup();
	const { block, state } = test;
	expect(block.displayModel.isCollapsed).toBe(true);
	expect(block.gaps.get(0)?.size).toBe(2);
	expect(block.height).toBe(test.height + 2 * state.viewport.hGrid);
	test.render();
	const [x, y, , width, height] = test.drawFill.mock.calls[0];
	const { vGrid, hGrid } = state.viewport;
	expect(Math.abs(x + width / 2 - block.width / 2)).toBeLessThanOrEqual(vGrid / 2);
	expect(x % vGrid).toBe(0);
	expect(y).toBe(hGrid);
	expect(width).toBe(15 * vGrid);
	expect(height).toBe(hGrid);
	expect(test.drawFill.mock.calls).toEqual([[x, y, PALETTE_INDICES.selectionSurface, width, hGrid]]);
	expect(test.drawGlyphs.mock.calls).toEqual([
		[x + width, y, textToGlyphIds('▄'), PALETTE_INDICES.black],
		[x + vGrid, y + hGrid, textToGlyphIds('▀'.repeat(15)), PALETTE_INDICES.black],
		[x + 2 * vGrid, y, textToGlyphIds('Enter group'), PALETTE_INDICES.selectionInk],
	]);
	expect(test.ordinary.gaps.size).toBe(0);
	test.render(test.ordinary);
	expect(test.drawGlyphs).not.toHaveBeenCalled();
	expect(test.drawFill).not.toHaveBeenCalled();
});

it('uses current font geometry and remains centered after the code block width changes', () => {
	const test = setup();
	const contribution = test.store.layout.createContribution();
	contribution.update(test.block, { verticalSpaceAfterSourceLine: [], minGridWidth: 53 });
	test.state.viewport.vGrid = 7;
	test.state.viewport.hGrid = 14;
	test.events.dispatch('gridSizeChanged');
	test.render();
	const [x, y, , width, height] = test.drawFill.mock.calls[0];
	expect(x + width / 2).toBe(test.block.width / 2);
	expect(x % 7).toBe(0);
	expect(y).toBe(14);
	expect(width).toBe(15 * 7);
	expect(height).toBe(14);
	expect(test.drawGlyphs).toHaveBeenCalledWith(x + width, y, textToGlyphIds('▄'), PALETTE_INDICES.black);
	expect(test.drawGlyphs).toHaveBeenCalledWith(
		x + 2 * 7,
		y,
		textToGlyphIds('Enter group'),
		PALETTE_INDICES.selectionInk
	);
	contribution.dispose();
});

it('softens only the shadow when switching to a light palette', () => {
	const test = setup();
	const buttonColors = () => {
		test.render();
		return [test.drawFill.mock.calls[0][2], ...test.drawGlyphs.mock.calls.map(call => call[3])];
	};
	const { selectionSurface, selectionInk, black, inkAlpha30 } = PALETTE_INDICES;
	expect(buttonColors()).toEqual([selectionSurface, black, black, selectionInk]);
	test.store.set('editorConfig.color', { canvas: '#dcd9d0', surface: '#f4f0e7', ink: '#3e4a4b' });
	expect(buttonColors()).toEqual([selectionSurface, inkAlpha30, inkAlpha30, selectionInk]);
	test.store.set('editorConfig.color', {});
	expect(buttonColors()).toEqual([selectionSurface, black, black, selectionInk]);
});

it('claims the button press and dispatches openProjectGroup on release inside', () => {
	const test = setup();
	test.state.viewport.x = 11;
	test.state.viewport.y = 15;
	test.render();
	const face = test.drawFill.mock.calls[0];
	const label = test.drawGlyphs.mock.calls[2];
	expect(test.press().stopPropagation).toBe(true);
	expect(test.openGroup).not.toHaveBeenCalled();
	test.render();
	expect(test.drawFill.mock.calls).toEqual([face]);
	expect(test.drawGlyphs.mock.calls).toEqual([label]);
	expect(test.release().stopPropagation).toBe(true);
	expect(test.openGroup).toHaveBeenCalledExactlyOnceWith({ codeBlock: test.block });
});

it('ignores non-primary and outside presses, and cancels when released outside or cancelled', () => {
	const test = setup();
	expect(test.press(test.block, { buttons: 2 }).stopPropagation).toBe(false);
	test.release();
	expect(test.press(test.block, { y: test.block.y - test.state.viewport.y }).stopPropagation).toBe(false);
	test.release();
	expect(test.press().stopPropagation).toBe(true);
	const outside = test.pointer(test.block, { x: 0, y: 0 });
	test.events.dispatch('pointermove', outside);
	expect(outside.stopPropagation).toBe(true);
	expect(test.release(test.block, { x: 0, y: 0 }).stopPropagation).toBe(true);
	expect(test.openGroup).not.toHaveBeenCalled();
	test.press();
	test.events.dispatch('pointercancel', test.pointer(test.block, { buttons: 0 }));
	test.release();
	expect(test.openGroup).not.toHaveBeenCalled();
});

it('cancels the button press when a dialog opens, even if it closes before release', () => {
	const test = setup();
	expect(test.press().stopPropagation).toBe(true);
	test.events.dispatch('addDialog', { id: 'modal', title: 'Modal', text: 'Please wait', buttons: [] });
	expect(test.state.dialogStack).toHaveLength(1);
	test.render();
	expect(test.drawGlyphs).toHaveBeenCalledTimes(3);
	test.events.dispatch('removeDialog', { id: 'modal' });
	expect(test.state.dialogStack).toHaveLength(0);
	expect(test.release().stopPropagation).toBe(false);
	expect(test.openGroup).not.toHaveBeenCalled();
});

it('cancels the button press when a context menu opens, even if it closes before release', async () => {
	const test = setup();
	expect(test.press().stopPropagation).toBe(true);
	test.events.dispatch('contextmenu', test.pointer(test.block, { buttons: 2 }));
	await vi.waitFor(() => expect(test.state.contextMenu.items.length).toBeGreaterThan(0));
	expect(test.state.contextMenu.open).toBe(true);
	test.render();
	expect(test.drawGlyphs).toHaveBeenCalledTimes(3);
	test.events.dispatch('closeContextMenu');
	expect(test.state.contextMenu.open).toBe(false);
	expect(test.release().stopPropagation).toBe(false);
	expect(test.openGroup).not.toHaveBeenCalled();
});

it('removes drawing, layout contributions, and input handlers on disposal', () => {
	const test = setup();
	test.press();
	test.dispose();
	expect(test.block.height).toBe(test.height);
	expect(test.block.gaps.size).toBe(0);
	test.render();
	expect(test.drawGlyphs).not.toHaveBeenCalled();
	expect(test.drawFill).not.toHaveBeenCalled();
	expect(test.press().stopPropagation).toBe(false);
	test.release();
	expect(test.openGroup).not.toHaveBeenCalled();
});
