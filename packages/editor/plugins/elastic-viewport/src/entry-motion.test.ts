import { describe, expect, it } from 'vitest';
import { createEntryMotion } from './entry-motion';
import { resolveElasticViewportOptions } from './options';

const defaults = resolveElasticViewportOptions({ prefersReducedMotion: () => false });

function setup(block: { x: number; y: number; width?: number; height?: number }) {
	const motion = createEntryMotion(defaults.entry, defaults.spring);
	const bounds = { width: 20, height: 20, ...block };
	let previousX = 0;
	let previousY = 0;
	let previousTime = 0;
	function beginFrame(time: number, x: number, y: number, manual = true) {
		motion.beginFrame(previousX, previousY, { x, y, width: 100, height: 100 }, time, time - previousTime, manual);
		previousX = x;
		previousY = y;
		previousTime = time;
	}
	function step(time: number, x: number, y: number, manual = true, offset = { x: 0, y: 0 }) {
		beginFrame(time, x, y, manual);
		motion.resolve(bounds, offset);
		return offset;
	}
	return { motion, beginFrame, step };
}

describe('viewport entry motion', () => {
	it.each([
		{ edge: 'left', block: { x: -20, y: 40 }, pan: { x: -6, y: 0 }, hold: { x: -6, y: 1 } },
		{ edge: 'right', block: { x: 100, y: 40 }, pan: { x: 6, y: 0 }, hold: { x: 6, y: 1 } },
		{ edge: 'top', block: { x: 40, y: -20 }, pan: { x: 0, y: -6 }, hold: { x: 1, y: -6 } },
		{ edge: 'bottom', block: { x: 40, y: 100 }, pan: { x: 0, y: 6 }, hold: { x: 1, y: 6 } },
	])('holds a new block on the $edge edge without changing tangential motion', ({ block, pan, hold }) => {
		const { motion, step } = setup(block);
		expect(step(16, pan.x, pan.y, true, { x: 1, y: 1 })).toEqual(hold);
		expect(motion.hasMotion()).toBe(true);
	});

	it('holds against the last crossed edge when entering diagonally', () => {
		const { step } = setup({ x: 104, y: 110 });
		expect(step(16, 12, 12)).toEqual({ x: 0, y: 2 });
		// Keep the chosen edge on later steps, when the block is already logically inside.
		expect(step(32, 16, 15)).toEqual({ x: 0, y: 5 });
	});

	it('releases from the held edge after enough pull, overshoots, and settles to the ordinary offset', () => {
		const { motion, step } = setup({ x: -20, y: 40 });
		expect(step(16, -6, 0, true, { x: -3, y: 0 })).toEqual({ x: -6, y: 0 });
		expect(step(32, -20, 0, true, { x: -4, y: 0 })).toEqual({ x: -20, y: 0 });
		expect(step(48, -64, 0, true, { x: -8, y: 0 })).toEqual({ x: -64, y: 0 });
		expect(step(64, -103, 0, true, { x: -8, y: 0 })).toEqual({ x: -103, y: 0 });
		expect(step(80, -104, 0, true, { x: -8, y: 0 })).toEqual({ x: -104, y: 0 });
		const firstMovement = step(96, -104, 0, false, { x: -8, y: 0 }).x;
		expect(firstMovement).toBeGreaterThan(-104);
		// The entry spring starts at the edge instead of jumping to the ordinary 48 px spring cap.
		expect(firstMovement).toBeLessThan(-56);
		expect(step(256, -104, 0, false, { x: -8, y: 0 }).x).toBeGreaterThan(-8);
		expect(step(640, -104, 0, false)).toEqual({ x: 0, y: 0 });
		expect(motion.hasMotion()).toBe(false);
		expect(step(656, -105, 0, true, { x: -2, y: 0 })).toEqual({ x: -2, y: 0 });
	});

	it('releases a partial entry when inward panning stops instead of leaving it hidden', () => {
		const { step } = setup({ x: -20, y: 40 });
		expect(step(16, -10, 0)).toEqual({ x: -10, y: 0 });
		// Panning sideways doesn't increase the pull on the entering edge.
		expect(step(105, -10, 1)).toEqual({ x: -10, y: 0 });
		expect(step(106, -10, 1, false)).toEqual({ x: -10, y: 0 });
		expect(step(138, -10, 1, false).x).toBeGreaterThan(-10);
	});

	it('does not latch a stationary or already-visible block', () => {
		const alreadyVisible = setup({ x: 5, y: 20 });
		expect(alreadyVisible.step(16, -10, 0, true, { x: -3, y: 0 })).toEqual({ x: -3, y: 0 });
		expect(alreadyVisible.motion.hasMotion()).toBe(false);
		const nonManual = setup({ x: -20, y: 20 });
		expect(nonManual.step(16, -10, 0, false, { x: -3, y: 0 })).toEqual({ x: -3, y: 0 });
		expect(nonManual.motion.hasMotion()).toBe(false);
	});

	it('cancels a hold when backing out and starts fresh on a later entry', () => {
		const { motion, step } = setup({ x: -20, y: 20 });
		expect(step(16, -10, 0)).toEqual({ x: -10, y: 0 });
		expect(step(32, 1, 0)).toEqual({ x: 0, y: 0 });
		expect(motion.hasMotion()).toBe(false);
		expect(step(48, -8, 0)).toEqual({ x: -8, y: 0 });
	});

	it('does not reuse entry state after a culled frame or reset', () => {
		const { motion, beginFrame, step } = setup({ x: -20, y: 20 });
		expect(step(16, -10, 0)).toEqual({ x: -10, y: 0 });
		beginFrame(32, 200, 0);
		expect(motion.hasMotion()).toBe(false);
		expect(step(48, -8, 0, false)).toEqual({ x: 0, y: 0 });
		step(64, 0, 0);
		expect(step(80, -10, 0)).toEqual({ x: -10, y: 0 });
		motion.reset();
		expect(motion.hasMotion()).toBe(false);
		expect(step(96, -10, 0, false)).toEqual({ x: 0, y: 0 });
	});

	it('bounds the correction when a single pan step reaches far into the viewport', () => {
		const { step } = setup({ x: -20, y: 20 });
		expect(step(16, -112, 0)).toEqual({ x: -96, y: 0 });
	});
});
