import type { Viewport } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import centerViewportOnCodeBlockCursor from './centerViewportOnCodeBlockCursor';

describe('centerViewportOnCodeBlockCursor', () => {
	it('centers horizontally on the block and vertically on the highlighted line', () => {
		const viewport: Viewport = {
			x: 0,
			y: 0,
			width: 800,
			height: 600,
			roundedWidth: 800,
			roundedHeight: 600,
			vGrid: 8,
			hGrid: 16,
		};
		const codeBlock = {
			x: 200,
			y: 400,
			width: 200,
			height: 160,
			cursor: { y: 48 },
		};

		const nextViewport = centerViewportOnCodeBlockCursor(viewport, codeBlock);

		expect(nextViewport.x).toBe(-96);
		expect(nextViewport.y).toBe(144);
		expect(viewport.x).toBe(0);
		expect(viewport.y).toBe(0);
	});
});
