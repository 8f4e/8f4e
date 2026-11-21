import { expect, it } from 'vitest';
import { createViewportTransition } from './viewport-transition';

const ORIGIN = { x: 0, y: 0 };

it.each([
	{ x: 100, duration: 40 },
	{ x: 500, duration: 200 },
	{ x: 2500, duration: 1000 },
])('moves at the same speed for a $x px jump', ({ x, duration }) => {
	const camera = createViewportTransition(ORIGIN);
	const target = { x, y: 0 };
	camera.onViewportChanged({ ...target, source: 'navigation' });
	camera.sample(target, 0, false);
	expect(camera.sample(target, 16, false).x).toBe(40);
	expect(camera.sample(target, 32, false).x).toBe(80);
	expect(camera.sample(target, duration - 4, false).x).toBe(x - 10);
	expect(camera.isTransitioning()).toBe(true);
	expect(camera.sample(target, duration, false).x).toBe(x);
	expect(camera.isTransitioning()).toBe(false);
});

it('glides diagonally at the same speed and stops at the committed viewport without overshoot', () => {
	const logical = { ...ORIGIN };
	const camera = createViewportTransition(logical);
	Object.assign(logical, { x: 150, y: -200 });
	camera.onViewportChanged({ ...logical, source: 'navigation' });
	expect(camera.isTransitioning()).toBe(true);
	const frame = camera.sample(logical, 100, false);
	expect(frame).toEqual({ ...ORIGIN, suppressBlockOffsets: true });
	expect(camera.sample(logical, 120, false)).toBe(frame);
	expect(frame).toEqual({ x: 30, y: -40, suppressBlockOffsets: true });
	expect(camera.isTransitioning()).toBe(true);
	expect(camera.sample(logical, 160, false)).toMatchObject({ x: 90, y: -120 });
	expect(camera.sample(logical, 198, false)).toMatchObject({ x: 147, y: -196 });
	expect(camera.sample(logical, 200, false)).toEqual({ x: 150, y: -200, suppressBlockOffsets: true });
	expect(camera.isTransitioning()).toBe(false);
	expect(camera.sample(logical, 220, false)).toEqual({ x: 150, y: -200, suppressBlockOffsets: false });
	expect(logical).toEqual({ x: 150, y: -200 });
});

it('retargets rapid keyboard navigation from the last rendered position', () => {
	const camera = createViewportTransition(ORIGIN);
	const first = { x: 150, y: 200 };
	camera.onViewportChanged({ ...first, source: 'navigation' });
	camera.sample(first, 0, false);
	expect(camera.sample(first, 41.2, false)).toMatchObject({ x: 62, y: 82 });
	camera.onViewportChanged({ x: -50, y: 150, source: 'navigation' });
	const next = { x: -88, y: -118 };
	camera.onViewportChanged({ ...next, source: 'navigation' });
	expect(camera.sample(next, 60, false)).toMatchObject({ x: 62, y: 82 });
	expect(camera.sample(next, 100, false)).toMatchObject({ x: 2, y: 2 });
	expect(camera.sample(next, 160, false)).toMatchObject(next);
	expect(camera.isTransitioning()).toBe(false);
});

it('ignores a navigation commit that already matches the presented origin', () => {
	const camera = createViewportTransition(ORIGIN);
	const target = { x: 150, y: 200 };
	camera.onViewportChanged({ ...target, source: 'navigation' });
	camera.sample(target, 0, false);
	camera.sample(target, 50, false);
	const next = { x: 75, y: 100 };
	camera.onViewportChanged({ ...next, source: 'navigation' });
	expect(camera.isTransitioning()).toBe(false);
	expect(camera.sample(next, 60, false)).toEqual({ ...next, suppressBlockOffsets: true });
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
	const target = { x: 113, y: 7 };
	camera.onViewportChanged({ ...target, source: 'navigation' });
	camera.sample(target, 20, false);
	expect(camera.sample(target, 40, false)).toMatchObject({ x: 63, y: 7 });
	expect(camera.sample(target, 30, false)).toMatchObject({ x: 63, y: 7 });
	expect(camera.sample(ORIGIN, 200, false)).toEqual({ ...ORIGIN, suppressBlockOffsets: true });
	expect(camera.isTransitioning()).toBe(false);
});
