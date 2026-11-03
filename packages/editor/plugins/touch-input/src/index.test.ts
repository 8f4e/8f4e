import { EMPTY_DEFAULT_PROJECT, serializeToProject } from '@8f4e/editor-state';
import { describe, expect, it } from 'vitest';
import { finger, setup } from './__tests__/setup';

const fingers = (x: number, y: number) => [finger(x, y), finger(x + 40, y + 40)];

describe('touch viewport navigation', () => {
	it('keeps vertical swipes native and preserves the vertical position in horizontal mode', () => {
		const test = setup(true, 1, 'horizontal');
		expect(test.inputTarget.style.touchAction).toBe('pan-y');
		test.state.viewport.y = 3;
		test.touch('touchstart', [finger(100, 100)]);
		expect(test.touch('touchmove', [finger(102, 130)]).defaultPrevented).toBe(false);
		test.touch('touchmove', [finger(140, 130)]);
		expect(test.changed).not.toHaveBeenCalled();
		test.touch('touchend');
		test.touch('touchstart', [finger(100, 100)]);
		expect(test.touch('touchmove', [finger(130, 105)]).defaultPrevented).toBe(true);
		test.touch('touchend');
		expect(test.state.viewport).toMatchObject({ x: -32, y: 3 });
	});

	it('keeps horizontal swipes native in vertical mode', () => {
		const test = setup(true, 1, 'vertical');
		expect(test.inputTarget.style.touchAction).toBe('pan-x');
		test.state.viewport.x = 3;
		test.touch('touchstart', [finger(100, 100)]);
		expect(test.touch('touchmove', [finger(130, 102)]).defaultPrevented).toBe(false);
		test.touch('touchend');
		test.touch('touchstart', [finger(100, 100)]);
		expect(test.touch('touchmove', [finger(105, 130)]).defaultPrevented).toBe(true);
		test.touch('touchend');
		expect(test.state.viewport).toMatchObject({ x: 3, y: -32 });
	});

	it.each([1, 2] as const)('requires exactly %i fingers when configured', fingerCount => {
		const test = setup(true, fingerCount);
		const points = (x: number, y: number) => fingers(x, y).slice(0, fingerCount);
		test.touch('touchstart', points(100, 100));
		expect(test.touch('touchmove', points(102, 101)).defaultPrevented).toBe(false);
		expect(test.touch('touchmove', points(130, 118)).defaultPrevented).toBe(true);
		expect(test.state.viewport).toMatchObject({ x: -30, y: -18 });
		test.touch('touchend');
		const viewport = { ...test.state.viewport };
		const wrongCount = fingerCount === 1 ? 2 : 1;
		test.touch('touchstart', fingers(100, 100).slice(0, wrongCount));
		test.touch('touchmove', fingers(140, 130).slice(0, wrongCount));
		expect(test.state.viewport).toEqual(viewport);
	});

	it.each(['view', 'edit'] as const)('pans without editing source or project history in %s mode', mode => {
		const test = setup();
		test.store.set('editorMode', mode);
		const source = serializeToProject(test.state);
		const revision = test.state.projectChange.revision;
		test.touch('touchstart', fingers(100, 100));
		expect(test.touch('touchmove', fingers(130, 118)).defaultPrevented).toBe(true);
		expect(test.state.viewport).toMatchObject({ x: -30, y: -18 });
		expect(test.changed).toHaveBeenCalledWith(expect.objectContaining({ previousX: 0, previousY: 0, x: -30, y: -18 }));
		expect(test.touch('touchend').defaultPrevented).toBe(true);
		expect(test.state.viewport).toMatchObject({ x: -32, y: -16 });
		expect(serializeToProject(test.state)).toEqual(source);
		expect(test.state.projectChange.revision).toBe(revision);
	});

	it('leaves one-finger taps and drags available to controls', () => {
		const test = setup();
		expect(test.touch('touchstart', [finger(100, 100)]).defaultPrevented).toBe(false);
		expect(test.touch('touchmove', [finger(140, 130)]).defaultPrevented).toBe(false);
		expect(test.touch('touchend').defaultPrevented).toBe(false);
		expect(test.changed).not.toHaveBeenCalled();
	});

	it('accumulates fractional movement from the gesture origin', () => {
		const test = setup();
		test.touch('touchstart', fingers(100, 100));
		for (let x = 106; x <= 110; x += 0.25) test.touch('touchmove', fingers(x, 100));
		expect(test.state.viewport.x).toBe(-10);
	});

	it('stops an active viewport animation when touch takes over', () => {
		const test = setup();
		test.state.viewportAnimation.active = true;
		test.touch('touchstart', fingers(100, 100));
		expect(test.state.viewportAnimation.active).toBe(false);
	});

	it('ends cancelled gestures and ignores subsequent movement', () => {
		const test = setup();
		test.touch('touchstart', fingers(100, 100));
		test.touch('touchmove', fingers(130, 118));
		test.touch('touchcancel');
		const { x, y } = test.state.viewport;
		test.touch('touchmove', fingers(180, 180));
		expect(test.state.viewport).toMatchObject({ x, y });
	});

	it('does not resume a gesture after a third finger is removed', () => {
		const test = setup();
		test.touch('touchstart', fingers(100, 100));
		test.touch('touchmove', fingers(130, 118));
		test.touch('touchstart', [...fingers(130, 118), finger(200, 200)]);
		const { x, y } = test.state.viewport;
		test.touch('touchend', fingers(130, 118));
		test.touch('touchmove', fingers(180, 180));
		expect(test.state.viewport).toMatchObject({ x, y });
	});

	it('respects viewport dragging changes and restores browser touch behavior', () => {
		const test = setup(false);
		expect(test.inputTarget.style.touchAction).toBe('pan-y');
		test.touch('touchstart', fingers(100, 100));
		expect(test.touch('touchmove', fingers(140, 140)).defaultPrevented).toBe(false);
		expect(test.changed).not.toHaveBeenCalled();
		test.store.set('featureFlags.viewportDragging', true);
		expect(test.inputTarget.style.touchAction).toBe('none');
		test.touch('touchstart', fingers(100, 100));
		test.store.set('featureFlags.viewportDragging', false);
		expect(test.inputTarget.style.touchAction).toBe('pan-y');
		test.touch('touchmove', fingers(140, 140));
		expect(test.changed).not.toHaveBeenCalled();
	});

	it('drops an active gesture when replacing the project', () => {
		const test = setup();
		test.touch('touchstart', fingers(100, 100));
		test.events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
		const { x, y } = test.state.viewport;
		test.touch('touchmove', fingers(140, 140));
		expect(test.state.viewport).toMatchObject({ x, y });
	});

	it('cleans up listeners, styles, and the active gesture when disposed', () => {
		const test = setup();
		test.touch('touchstart', fingers(100, 100));
		test.dispose();
		test.store.set('featureFlags.viewportDragging', false);
		test.store.set('featureFlags.viewportDragging', true);
		expect(test.inputTarget.style.touchAction).toBe('pan-y');
		test.touch('touchmove', fingers(140, 140));
		expect(test.changed).not.toHaveBeenCalled();
	});

	it('keeps gesture state separate for each editor', () => {
		const first = setup();
		const second = setup();
		first.touch('touchstart', fingers(100, 100));
		second.touch('touchmove', fingers(140, 140));
		expect(second.changed).not.toHaveBeenCalled();
	});
});
