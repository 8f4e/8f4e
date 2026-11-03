import type { InternalPointerEvent, State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, type MockInstance } from 'vitest';
import { createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import dialog from './effect';

describe('dialog effect', () => {
	function setup(state: State) {
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		dialog(store, events);

		const onResize = (events.on as unknown as MockInstance).mock.calls.find(
			call => call[0] === 'resize'
		)![1] as () => void;

		function emit<T>(eventName: string, event?: T) {
			const callback = (events.on as unknown as MockInstance).mock.calls.find(call => call[0] === eventName)![1] as (
				event?: T
			) => void;
			callback(event);
		}

		return { emit, events, onResize };
	}

	it('uses the minimum dialog width when half the viewport is too narrow', () => {
		const state = createMockState({
			dialogStack: [
				{
					id: 'test-dialog',
					text: 'Short text',
					title: 'Test Dialog',
					buttons: [],
				},
			],
			viewport: {
				width: 640,
				height: 768,
				vGrid: 8,
				hGrid: 16,
			},
		});
		const { onResize } = setup(state);

		onResize();

		expect(state.dialog.width).toBe(512);
		expect(state.dialog.height).toBe(96);
		expect(state.dialog.x).toBe(64);
		expect(state.dialog.y).toBe(336);
	});

	it('sizes the dialog to half the viewport between the minimum and maximum width', () => {
		const state = createMockState({
			dialogStack: [
				{
					id: 'test-dialog',
					text: 'Short text',
					title: 'Test Dialog',
					buttons: [],
				},
			],
			viewport: {
				width: 1280,
				height: 768,
				vGrid: 8,
				hGrid: 16,
			},
		});
		const { onResize } = setup(state);

		onResize();

		expect(state.dialog.width).toBe(640);
		expect(state.dialog.height).toBe(96);
		expect(state.dialog.x).toBe(320);
		expect(state.dialog.y).toBe(336);
	});

	it.each([320, 375, 390])('keeps dialog content and working buttons inside a %ipx portrait viewport', width => {
		const state = createMockState({
			dialogStack: [
				{
					id: 'audio',
					title: 'Audio playback permission and device settings',
					text: 'Audio playback requires permission. Tap Allow to start sound on this device.',
					buttons: [{ title: 'Cancel' }, { title: 'More information' }, { title: 'Allow audio', action: 'allowAudio' }],
				},
			],
			viewport: { width: 1280, height: 768, vGrid: 8, hGrid: 16 },
		});
		const { onResize, emit, events } = setup(state);
		state.viewport.width = width;
		onResize();
		expect(state.dialog.x).toBeGreaterThanOrEqual(8);
		expect(state.dialog.x + state.dialog.width).toBeLessThanOrEqual(width - 8);
		const textWidth = state.dialog.width / state.viewport.vGrid - 2;
		expect(state.dialog.title.length).toBeLessThanOrEqual(textWidth);
		for (const line of state.dialog.wrappedText) expect(line.length).toBeLessThanOrEqual(textWidth);
		expect(new Set(state.dialog.buttons.map(button => button.y)).size).toBeGreaterThan(1);
		for (const button of state.dialog.buttons) {
			expect(button.x).toBeGreaterThanOrEqual(8);
			expect(button.x + button.width).toBeLessThanOrEqual(state.dialog.width - 8);
			expect(button.y + button.height).toBeLessThanOrEqual(state.dialog.height - 16);
		}
		const button = state.dialog.buttons[2];
		emit('pointerdown', {
			x: state.dialog.x + button.x + button.width / 2,
			y: state.dialog.y + button.y + button.height / 2,
			stopPropagation: false,
		});
		expect(events.dispatch).toHaveBeenCalledWith('allowAudio', undefined);
		expect(state.dialogStack).toEqual([]);
	});

	it('caps the dialog width at 96 grid cells', () => {
		const state = createMockState({
			dialogStack: [
				{
					id: 'test-dialog',
					text: 'a'.repeat(300),
					title: 'Test Dialog',
					buttons: [],
				},
			],
			viewport: {
				width: 5200,
				height: 768,
				vGrid: 8,
				hGrid: 16,
			},
		});
		const { onResize } = setup(state);

		onResize();

		expect(state.dialog.width).toBe(768);
		expect(state.dialog.height).toBe(144);
		expect(state.dialog.x).toBe(2216);
		expect(state.dialog.y).toBe(320);
		expect(state.dialog.wrappedText[0]).toHaveLength(94);
	});

	it('renders only the top dialog from the stack', () => {
		const state = createMockState({
			viewport: {
				width: 1280,
				height: 768,
				vGrid: 8,
				hGrid: 16,
			},
		});
		const { emit } = setup(state);

		emit('addDialog', {
			id: 'first-dialog',
			text: 'First',
			title: 'First Dialog',
			buttons: [],
		});

		expect(state.dialog.id).toBe('first-dialog');
		expect(state.dialog.title).toBe('First Dialog');

		emit('addDialog', {
			id: 'second-dialog',
			text: 'Second',
			title: 'Second Dialog',
			buttons: [],
		});

		expect(state.dialog.id).toBe('second-dialog');
		expect(state.dialog.title).toBe('Second Dialog');

		emit('removeDialog', { id: 'second-dialog' });

		expect(state.dialog.id).toBe('first-dialog');
		expect(state.dialog.title).toBe('First Dialog');

		emit('removeDialog', 'first-dialog');

		expect(state.dialogStack).toEqual([]);
		expect(state.dialog.id).toBe('');
	});

	it('lays out and activates dialog buttons while blocking pointer propagation', () => {
		const state = createMockState({
			dialogStack: [
				{
					id: 'confirmation',
					text: 'Continue?',
					title: 'Confirm',
					buttons: [{ title: 'Cancel' }, { title: 'Allow', action: 'confirmAction', payload: { id: 42 } }],
				},
			],
			viewport: {
				width: 1280,
				height: 768,
				vGrid: 8,
				hGrid: 16,
			},
		});
		const { emit, events } = setup(state);

		expect(state.dialog.height).toBe(144);
		expect(state.dialog.buttons).toEqual([
			{ title: 'Cancel', x: 408, y: 80, width: 112, height: 48 },
			{ title: 'Allow', action: 'confirmAction', payload: { id: 42 }, x: 528, y: 80, width: 104, height: 48 },
		]);

		const pointerEvent: InternalPointerEvent = {
			x: state.dialog.x + state.dialog.buttons[1].x + 1,
			y: state.dialog.y + state.dialog.buttons[1].y + 1,
			movementX: 0,
			movementY: 0,
			buttons: 1,
			stopPropagation: false,
			canvasWidth: 1280,
			canvasHeight: 768,
			altKey: false,
		};

		emit('pointermove', pointerEvent);
		expect(state.dialog.highlightedButton).toBe(1);
		expect(pointerEvent.stopPropagation).toBe(true);

		pointerEvent.stopPropagation = false;
		emit('pointerdown', pointerEvent);

		expect(pointerEvent.stopPropagation).toBe(true);
		expect(state.dialogStack).toEqual([]);
		expect(events.dispatch).toHaveBeenCalledWith('confirmAction', { id: 42 });
	});

	it('blocks clicks outside dialog buttons without closing the dialog', () => {
		const state = createMockState({
			dialogStack: [
				{
					id: 'loading',
					text: 'Please wait',
					title: 'Loading',
					buttons: [],
				},
			],
		});
		const { emit, events } = setup(state);
		const pointerEvent = {
			x: 0,
			y: 0,
			stopPropagation: false,
		} as InternalPointerEvent;

		emit('pointerdown', pointerEvent);

		expect(pointerEvent.stopPropagation).toBe(true);
		expect(state.dialogStack).toHaveLength(1);
		expect(events.dispatch).not.toHaveBeenCalled();
	});

	it('keeps the dialog open when a button opts out of closing it', () => {
		const state = createMockState({
			dialogStack: [
				{
					id: 'retry-dialog',
					text: 'Try again?',
					title: 'Retry',
					buttons: [{ title: 'Retry', action: 'retryAction', close: false }],
				},
			],
		});
		const { emit, events } = setup(state);
		const button = state.dialog.buttons[0];
		const pointerEvent = {
			x: state.dialog.x + button.x + 1,
			y: state.dialog.y + button.y + 1,
			stopPropagation: false,
		} as InternalPointerEvent;

		emit('pointerdown', pointerEvent);

		expect(state.dialogStack).toHaveLength(1);
		expect(events.dispatch).toHaveBeenCalledWith('retryAction', undefined);
	});
});
