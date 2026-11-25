import { describe, expect, it } from 'vitest';
import { resolveElasticViewportOptions } from './options';
import { createViewportSpring, createViewportSpringSolver } from './spring';

const { spring: springOptions } = resolveElasticViewportOptions({ prefersReducedMotion: () => false });

describe('viewport spring solver', () => {
	it('advances independent spring states with the same critical damping response', () => {
		const advance = createViewportSpringSolver(10, 48, { ...springOptions, dampingRatio: 1 });
		const horizontal = { ...createViewportSpring(), x: 10, vx: 4 };
		const vertical = { ...createViewportSpring(), y: 20, vy: -6 };

		advance(horizontal, 0.1, 0, 0);
		advance(vertical, 0.1, 2, -3);

		// At elapsed time 1 / frequency, the critical damping response simplifies to these values.
		expect(horizontal.x).toBeCloseTo(20.4 / Math.E);
		expect(horizontal.vx).toBeCloseTo(-100 / Math.E);
		expect(vertical.x).toBe(2);
		expect(vertical.y).toBeCloseTo(39.4 / Math.E - 3);
		expect(vertical.vy).toBeCloseTo(-200 / Math.E);
	});

	it('updates the shared response when the elapsed time changes', () => {
		const advance = createViewportSpringSolver(10, 48, springOptions);
		const split = { ...createViewportSpring(), x: 24, y: -8 };
		const single = { ...split };

		advance(split, 0.04, 0, 0);
		advance(single, 0.12, 0, 0);
		advance(split, 0.04, 0, 0);
		advance(split, 0.04, 0, 0);

		for (const key of ['x', 'y', 'vx', 'vy'] as const) expect(split[key]).toBeCloseTo(single[key], 10);
	});
});
