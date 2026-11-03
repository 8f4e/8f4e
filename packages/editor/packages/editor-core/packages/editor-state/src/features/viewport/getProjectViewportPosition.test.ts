import { describe, expect, it } from 'vitest';
import { createMockCodeBlock, createMockViewport } from '~/pureHelpers/testingUtils/testUtils';
import getProjectViewportPosition from './getProjectViewportPosition';

describe('project viewport placement', () => {
	it('prefers a remembered origin over a home block', () => {
		const home = createMockCodeBlock({ isHome: true, x: 2000, y: 1000 });
		expect(
			getProjectViewportPosition(
				{ entries: [], path: '', blocks: [home], viewport: { x: 0, y: 0 } },
				createMockViewport()
			)
		).toEqual({ x: 0, y: 0 });
	});

	it('uses home alignment on the first visit', () => {
		const home = createMockCodeBlock({ isHome: true, homeAlignment: 'left', x: 1000, y: 1000, width: 80, height: 80 });
		expect(getProjectViewportPosition({ entries: [], path: 'Audio', blocks: [home] }, createMockViewport())).toEqual({
			x: 840,
			y: 736,
		});
	});

	it('starts at the origin without a remembered view or home block', () => {
		expect(getProjectViewportPosition({ entries: [], path: 'Audio', blocks: [] }, createMockViewport())).toEqual({
			x: 0,
			y: 0,
		});
	});
});
