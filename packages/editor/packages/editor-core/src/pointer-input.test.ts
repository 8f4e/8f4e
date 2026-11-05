import initState, { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import type { CodeBlockPointerDownEvent, InternalPointerEvent } from '@8f4e/editor-state-types';
import { afterEach, expect, it, vi } from 'vitest';
import createEvents from './events';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup(moduleDragging = true) {
	const events = createEvents();
	const store = initState(events, { callbacks: {}, featureFlags: { moduleDragging } });
	events.dispatch('loadProject', {
		project: {
			...EMPTY_DEFAULT_PROJECT,
			notes: [{ id: 0, code: ['note target', '; @pos 10 10', 'Pointer target', 'noteEnd'] }],
		},
	});
	const state = store.getState();
	const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'target')!;
	const pointer: InternalPointerEvent = {
		x: block.x - state.viewport.x + 8,
		y: block.y - state.viewport.y + 8,
		movementX: 0,
		movementY: 0,
		buttons: 1,
		altKey: false,
		stopPropagation: false,
		canvasWidth: 800,
		canvasHeight: 600,
	};
	cleanups.push(() => {
		store.dispose();
		events.dispose();
	});
	return { events, store, state, block, pointer };
}

it.each([true, false])('routes controls before block selection with moduleDragging=%s', moduleDragging => {
	const test = setup(moduleDragging);
	const pressed = vi.fn((event: CodeBlockPointerDownEvent) => {
		expect(test.state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		expect(test.state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		event.stopPropagation = true;
	});
	test.events.on('codeBlockPointerDown', pressed, { capture: true });
	test.events.dispatch('pointerdown', test.pointer);
	expect(pressed).toHaveBeenCalledOnce();
	expect(pressed.mock.calls[0][0].codeBlock).toBe(test.block);
	expect(test.pointer.stopPropagation).toBe(true);
	expect(test.state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
});

it('delivers ordinary block presses after default selection', () => {
	const test = setup();
	const pressed = vi.fn((event: CodeBlockPointerDownEvent) => {
		expect(test.state.codeBlockRendering.selectedCodeBlock).toBe(event.codeBlock);
	});
	test.events.on('codeBlockPointerDown', pressed);
	test.events.dispatch('pointerdown', test.pointer);
	expect(pressed).toHaveBeenCalledOnce();
});

it('probes interactions without committing default selection, dragging, or viewport movement', () => {
	const test = setup();
	const viewport = { x: test.state.viewport.x, y: test.state.viewport.y };
	const revision = test.state.projectChange.revision;
	test.events.dispatch('pointerdown', test.pointer, { phase: 'capture' });
	test.events.dispatch('pointermove', { ...test.pointer, movementX: 40, movementY: 30 }, { phase: 'capture' });
	test.events.dispatch('pointerup', { ...test.pointer, buttons: 0 }, { phase: 'capture' });
	expect(test.state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
	expect(test.state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
	expect(test.state.viewport).toMatchObject(viewport);
	expect(test.state.projectChange.revision).toBe(revision);
});

it('gives modal dialogs priority over controls', () => {
	const test = setup();
	const pressed = vi.fn();
	test.events.on('codeBlockPointerDown', pressed, { capture: true });
	test.events.dispatch('addDialog', { id: 'modal', title: 'Modal', text: 'Please wait', buttons: [] });
	test.events.dispatch('pointerdown', test.pointer);
	expect(pressed).not.toHaveBeenCalled();
	expect(test.pointer.stopPropagation).toBe(true);
});

it('leaves dialog activation to the completed press after a capture-only probe', () => {
	const test = setup();
	const activate = vi.fn();
	test.events.on('activateDialog', activate);
	test.events.dispatch('addDialog', {
		id: 'modal',
		title: 'Modal',
		text: 'Continue?',
		buttons: [{ title: 'Allow', action: 'activateDialog' }],
	});
	const request = vi.fn(() => test.events.dispatch('activateDialogButton', { id: 'modal', buttonIndex: 0 }));
	test.events.on('dialogPointerDown', request);
	const pointer = { ...test.pointer };
	test.events.dispatch('pointerdown', pointer, { phase: 'capture' });
	expect(activate).not.toHaveBeenCalled();
	expect(request).not.toHaveBeenCalled();
	expect(test.state.dialogStack).toHaveLength(1);
	test.events.dispatch('pointerdown', { ...pointer, stopPropagation: false });
	expect(activate).toHaveBeenCalledOnce();
	expect(test.state.dialogStack).toHaveLength(0);
});

it('blocks menu movement and closing presses from reaching blocks or moving the viewport', () => {
	const test = setup();
	const blockPressed = vi.fn();
	const menuMoved = vi.fn();
	const menuPressed = vi.fn(() => test.events.dispatch('closeContextMenu'));
	test.events.on('codeBlockPointerDown', blockPressed, { capture: true });
	test.events.on('codeBlockPointerDown', blockPressed);
	test.events.on('contextMenuPointerMove', menuMoved);
	test.events.on('contextMenuPointerDown', menuPressed);
	test.events.dispatch('contextmenu', test.pointer);
	const viewport = { x: test.state.viewport.x, y: test.state.viewport.y };
	const revision = test.state.projectChange.revision;
	const move = { ...test.pointer, x: 0, y: 0, movementX: 40, movementY: 30 };
	test.events.dispatch('pointermove', move);
	expect(menuMoved).toHaveBeenCalledExactlyOnceWith(move);
	expect(move.stopPropagation).toBe(true);
	expect(test.state.viewport).toMatchObject(viewport);
	test.events.dispatch('pointerdown', test.pointer);
	expect(menuPressed).toHaveBeenCalledExactlyOnceWith(test.pointer);
	expect(test.pointer.stopPropagation).toBe(true);
	expect(test.state.contextMenu.open).toBe(false);
	expect(blockPressed).not.toHaveBeenCalled();
	expect(test.state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
	expect(test.state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
	expect(test.state.projectChange.revision).toBe(revision);
});

it('forwards menu presses only after capture-only probes complete', () => {
	const test = setup();
	const menuPressed = vi.fn();
	const blockPressed = vi.fn();
	test.events.on('contextMenuPointerDown', menuPressed);
	test.events.on('codeBlockPointerDown', blockPressed, { capture: true });
	test.events.dispatch('contextmenu', test.pointer);
	test.events.dispatch('pointerdown', { ...test.pointer }, { phase: 'capture' });
	expect(menuPressed).not.toHaveBeenCalled();
	expect(blockPressed).not.toHaveBeenCalled();
	expect(test.state.contextMenu.open).toBe(true);
	test.events.dispatch('pointerdown', test.pointer);
	expect(menuPressed).toHaveBeenCalledExactlyOnceWith(test.pointer);
	expect(blockPressed).not.toHaveBeenCalled();
});

it('gives modal dialogs priority over menu pointer forwarding', () => {
	const test = setup();
	const menuPressed = vi.fn();
	const menuMoved = vi.fn();
	test.events.on('contextMenuPointerDown', menuPressed);
	test.events.on('contextMenuPointerMove', menuMoved);
	test.events.dispatch('contextmenu', test.pointer);
	test.events.dispatch('addDialog', { id: 'modal', title: 'Modal', text: 'Please wait', buttons: [] });
	const move = { ...test.pointer };
	test.events.dispatch('pointermove', move);
	test.events.dispatch('pointerdown', test.pointer);
	expect(menuMoved).not.toHaveBeenCalled();
	expect(menuPressed).not.toHaveBeenCalled();
	expect(move.stopPropagation).toBe(true);
	expect(test.pointer.stopPropagation).toBe(true);
	expect(test.state.contextMenu.open).toBe(true);
});

it.each(['pointerup', 'pointercancel'])('releases a claimed control on %s', type => {
	const test = setup();
	const released = vi.fn();
	test.events.on('codeBlockPointerUp', released);
	test.events.dispatch(type, test.pointer, { phase: 'capture' });
	expect(released).toHaveBeenCalledOnce();
});
