import { describe, expect, it } from 'vitest';
import { createMockState } from '~/pureHelpers/testingUtils/testUtils';
import resize from './resize';

describe('resize', () => {
	it('updates raw and grid-rounded viewport dimensions', () => {
		const state = createMockState({
			viewport: {
				x: 5,
				y: 15,
				vGrid: 8,
				hGrid: 10,
			},
		});

		resize(state, 123, 95);

		const viewport = state.viewport;
		expect(viewport.width).toBe(123);
		expect(viewport.height).toBe(95);
		expect(viewport.roundedWidth).toBe(120);
		expect(viewport.roundedHeight).toBe(90);
	});
});
