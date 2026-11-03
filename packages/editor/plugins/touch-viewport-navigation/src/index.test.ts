import { EMPTY_DEFAULT_PROJECT, serializeToProject } from '@8f4e/editor-state';
import { describe, expect, it } from 'vitest';
import { finger, setup } from './__tests__/setup';

describe('touch viewport navigation', () => {
	it.each(['view', 'edit'] as const)('pans without editing source or project history in %s mode', mode => {
		const test = setup();
		test.store.set('editorMode', mode);
		const source = serializeToProject(test.state);
		const revision = test.state.projectChange.revision;
		test.touch('touchstart', [finger(100, 100)]);
		expect(test.touch('touchmove', [finger(130, 118)]).defaultPrevented).toBe(true);
		expect(test.state.viewport).toMatchObject({ x: -30, y: -18 });
		expect(test.changed).toHaveBeenCalledWith(expect.objectContaining({ previousX: 0, previousY: 0, x: -30, y: -18 }));
		expect(test.touch('touchend').defaultPrevented).toBe(true);
		expect(test.state.viewport).toMatchObject({ x: -32, y: -16 });
		expect(serializeToProject(test.state)).toEqual(source);
		expect(test.state.projectChange.revision).toBe(revision);
	});

	it('leaves taps and small finger movements available to controls', () => {
		const test = setup();
		expect(test.touch('touchstart', [finger(100, 100)]).defaultPrevented).toBe(false);
		expect(test.touch('touchmove', [finger(102, 101)]).defaultPrevented).toBe(false);
		expect(test.touch('touchend').defaultPrevented).toBe(false);
		expect(test.changed).not.toHaveBeenCalled();
	});

	it('accumulates fractional movement from the gesture origin', () => {
		const test = setup();
		test.touch('touchstart', [finger(100, 100)]);
		for (let x = 106; x <= 110; x += 0.25) test.touch('touchmove', [finger(x, 100)]);
		expect(test.state.viewport.x).toBe(-10);
	});

	it('stops an active viewport animation when touch takes over', () => {
		const test = setup();
		test.state.viewportAnimation.active = true;
		test.touch('touchstart', [finger(100, 100)]);
		expect(test.state.viewportAnimation.active).toBe(false);
	});

	it('ends cancelled gestures and ignores subsequent movement', () => {
		const test = setup();
		test.touch('touchstart', [finger(100, 100)]);
		test.touch('touchmove', [finger(130, 118)]);
		test.touch('touchcancel');
		const { x, y } = test.state.viewport;
		test.touch('touchmove', [finger(180, 180)]);
		expect(test.state.viewport).toMatchObject({ x, y });
	});

	it('does not resume a gesture after a second finger is removed', () => {
		const test = setup();
		test.touch('touchstart', [finger(100, 100)]);
		test.touch('touchmove', [finger(130, 118)]);
		test.touch('touchstart', [finger(130, 118), finger(150, 150)]);
		const { x, y } = test.state.viewport;
		test.touch('touchend', [finger(130, 118)]);
		test.touch('touchmove', [finger(180, 180)]);
		expect(test.state.viewport).toMatchObject({ x, y });
	});

	it('respects viewport dragging changes and restores browser touch behavior', () => {
		const test = setup(false);
		expect(test.inputTarget.style.touchAction).toBe('pan-y');
		test.touch('touchstart', [finger(100, 100)]);
		expect(test.touch('touchmove', [finger(140, 140)]).defaultPrevented).toBe(false);
		expect(test.changed).not.toHaveBeenCalled();
		test.store.set('featureFlags.viewportDragging', true);
		expect(test.inputTarget.style.touchAction).toBe('none');
		test.touch('touchstart', [finger(100, 100)]);
		test.store.set('featureFlags.viewportDragging', false);
		expect(test.inputTarget.style.touchAction).toBe('pan-y');
		test.touch('touchmove', [finger(140, 140)]);
		expect(test.changed).not.toHaveBeenCalled();
	});

	it('drops an active gesture when replacing the project', () => {
		const test = setup();
		test.touch('touchstart', [finger(100, 100)]);
		test.events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
		const { x, y } = test.state.viewport;
		test.touch('touchmove', [finger(140, 140)]);
		expect(test.state.viewport).toMatchObject({ x, y });
	});

	it('cleans up listeners, styles, and the active gesture when disposed', () => {
		const test = setup();
		test.touch('touchstart', [finger(100, 100)]);
		test.dispose();
		test.store.set('featureFlags.viewportDragging', false);
		test.store.set('featureFlags.viewportDragging', true);
		expect(test.inputTarget.style.touchAction).toBe('pan-y');
		test.touch('touchmove', [finger(140, 140)]);
		expect(test.changed).not.toHaveBeenCalled();
	});

	it('keeps gesture state separate for each editor', () => {
		const first = setup();
		const second = setup();
		first.touch('touchstart', [finger(100, 100)]);
		second.touch('touchmove', [finger(140, 140)]);
		expect(second.changed).not.toHaveBeenCalled();
	});
});
