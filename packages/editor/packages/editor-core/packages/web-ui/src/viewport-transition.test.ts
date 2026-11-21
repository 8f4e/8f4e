import { expect, it } from 'vitest';
import { createViewportTransition } from './viewport-transition';

const ORIGIN = { x: 0, y: 0 };

it('glides the visual camera without stepping or mutating the committed viewport', () => {
	const logical = { ...ORIGIN };
	const camera = createViewportTransition(logical);
	Object.assign(logical, { x: 81, y: -35 });
	camera.onViewportChanged({ ...logical, source: 'navigation' });
	expect(camera.isTransitioning()).toBe(true);
	const frame = camera.sample(logical, 100, false);
	expect(frame).toEqual({ ...ORIGIN, suppressBlockOffsets: true });
	expect(camera.sample(logical, 150, false)).toBe(frame);
	expect(frame).toEqual({ x: 5, y: -2, suppressBlockOffsets: true });
	expect(camera.isTransitioning()).toBe(true);
	expect(camera.sample(logical, 200, false)).toMatchObject({ x: 41, y: -17 });
	expect(camera.sample(logical, 300, false)).toEqual({ ...logical, suppressBlockOffsets: true });
	expect(camera.isTransitioning()).toBe(false);
	expect(camera.sample(logical, 301, false).suppressBlockOffsets).toBe(false);
	expect(logical).toEqual({ x: 81, y: -35 });
});

it('retargets rapid keyboard navigation from the last rendered position', () => {
	const camera = createViewportTransition(ORIGIN);
	const first = { x: 100, y: 200 };
	camera.onViewportChanged({ ...first, source: 'navigation' });
	camera.sample(first, 0, false);
	expect(camera.sample(first, 100, false)).toMatchObject({ x: 50, y: 100 });
	camera.onViewportChanged({ x: -50, y: 150, source: 'navigation' });
	const next = { x: -25, y: -30 };
	camera.onViewportChanged({ ...next, source: 'navigation' });
	expect(camera.sample(next, 120, false)).toMatchObject({ x: 50, y: 100 });
	expect(camera.sample(next, 220, false)).toMatchObject({ x: 13, y: 35 });
	expect(camera.sample(next, 320, false)).toMatchObject(next);
});

it('ignores a navigation commit that already matches the presented origin', () => {
	const camera = createViewportTransition(ORIGIN);
	const target = { x: 100, y: 200 };
	camera.onViewportChanged({ ...target, source: 'navigation' });
	camera.sample(target, 0, false);
	camera.sample(target, 100, false);
	const next = { x: 50, y: 100 };
	camera.onViewportChanged({ ...next, source: 'navigation' });
	expect(camera.isTransitioning()).toBe(false);
	expect(camera.sample(next, 120, false)).toEqual({ ...next, suppressBlockOffsets: true });
});

it('cancels a sampled glide on a manual pan and allows the springs to respond to that pan', () => {
	const camera = createViewportTransition(ORIGIN);
	const target = { x: 100, y: 0 };
	camera.onViewportChanged({ ...target, source: 'navigation' });
	camera.sample(target, 0, false);
	const next = { x: 104, y: 0 };
	camera.onViewportChanged({ ...next, source: 'pan' });
	expect(camera.isTransitioning()).toBe(false);
	expect(camera.sample(next, 80, false)).toEqual({ ...next, suppressBlockOffsets: false });
});

it('suppresses the springs if a pending pan includes any unsampled non-pan displacement', () => {
	const camera = createViewportTransition(ORIGIN);
	camera.onViewportChanged({ x: 100, y: 0, source: 'navigation' });
	camera.onViewportChanged({ x: 150, y: 0 });
	const last = { x: 151, y: 1 };
	camera.onViewportChanged({ ...last, source: 'pan' });
	expect(camera.sample(last, 0, false)).toEqual({ ...last, suppressBlockOffsets: true });
	const next = { x: 152, y: 1 };
	camera.onViewportChanged({ ...next, source: 'pan' });
	expect(camera.sample(next, 16, false)).toEqual({ ...next, suppressBlockOffsets: false });
});

it('snaps to the destination when reduced motion becomes active or a host reset cancels the transition', () => {
	const camera = createViewportTransition(ORIGIN);
	const first = { x: 100, y: 200 };
	camera.onViewportChanged({ ...first, source: 'navigation' });
	camera.sample(first, 0, false);
	expect(camera.sample(first, 50, true)).toEqual({ ...first, suppressBlockOffsets: true });
	expect(camera.isTransitioning()).toBe(false);
	const next = { x: -50, y: 120 };
	camera.onViewportChanged({ ...next, source: 'navigation' });
	camera.reset();
	expect(camera.isTransitioning()).toBe(false);
	expect(camera.sample(next, 100, false)).toEqual({ ...next, suppressBlockOffsets: true });
});

it('follows direct logical viewport changes without inventing a glide or moving backwards in time', () => {
	const camera = createViewportTransition(ORIGIN);
	const first = { x: 13, y: 7 };
	expect(camera.sample(first, 0, false)).toEqual({ ...first, suppressBlockOffsets: false });
	expect(camera.isTransitioning()).toBe(false);
	const target = { x: 113, y: 107 };
	camera.onViewportChanged({ ...target, source: 'navigation' });
	camera.sample(target, 20, false);
	expect(camera.sample(target, 120, false)).toMatchObject({ x: 63, y: 57 });
	expect(camera.sample(target, 110, false)).toMatchObject({ x: 63, y: 57 });
	expect(camera.sample(ORIGIN, 200, false)).toEqual({ ...ORIGIN, suppressBlockOffsets: true });
	expect(camera.isTransitioning()).toBe(false);
});
