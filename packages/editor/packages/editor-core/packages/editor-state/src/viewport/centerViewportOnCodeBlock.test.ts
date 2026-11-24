import { describe, expect, it } from 'vitest';
import { createMockViewport } from '~/__tests__/helpers/mockEditorState';
import centerViewportOnCodeBlock, { type CodeBlockBounds } from './centerViewportOnCodeBlock';

function createMockCodeBlock(x: number, y: number, width: number, height: number): CodeBlockBounds {
	return {
		x,
		y,
		width,
		height,
	};
}

describe('centerViewportOnCodeBlock', () => {
	it('returns the centered horizontal viewport position for a small block', () => {
		const viewport = createMockViewport(0, 0, 800, 600);
		const codeBlock = createMockCodeBlock(100, 100, 200, 100);

		expect(centerViewportOnCodeBlock(viewport, codeBlock)).toEqual({ x: -200, y: -144 });
	});

	it('returns the centered position for a block at the origin', () => {
		const viewport = createMockViewport(0, 0, 400, 300);
		const codeBlock = createMockCodeBlock(0, 0, 100, 100);

		expect(centerViewportOnCodeBlock(viewport, codeBlock)).toEqual({ x: -152, y: -96 });
	});

	it('returns the centered horizontal position for a wide block', () => {
		const viewport = createMockViewport(0, 0, 800, 600);
		const codeBlock = createMockCodeBlock(0, 0, 1000, 100);

		expect(centerViewportOnCodeBlock(viewport, codeBlock).x).toBe(104);
	});

	it('places the code block center on the left quarter of the viewport when aligned left', () => {
		const viewport = createMockViewport(0, 0, 800, 600);
		const codeBlock = createMockCodeBlock(100, 100, 200, 100);

		expect(centerViewportOnCodeBlock(viewport, codeBlock, { alignment: 'left' }).x).toBe(0);
	});

	it('places the code block center on the right quarter of the viewport when aligned right', () => {
		const viewport = createMockViewport(0, 0, 800, 600);
		const codeBlock = createMockCodeBlock(100, 100, 200, 100);

		expect(centerViewportOnCodeBlock(viewport, codeBlock, { alignment: 'right' }).x).toBe(-400);
	});

	it('places the code block center on the top quarter of the viewport when aligned top', () => {
		const viewport = createMockViewport(0, 0, 800, 600);
		const codeBlock = createMockCodeBlock(100, 200, 100, 100);

		expect(centerViewportOnCodeBlock(viewport, codeBlock, { alignment: 'top' }).y).toBe(96);
	});

	it('places the code block center on the bottom quarter of the viewport when aligned bottom', () => {
		const viewport = createMockViewport(0, 0, 800, 600);
		const codeBlock = createMockCodeBlock(100, 200, 100, 100);

		expect(centerViewportOnCodeBlock(viewport, codeBlock, { alignment: 'bottom' }).y).toBe(-192);
	});

	it('centers a small block vertically when it fits in the viewport', () => {
		const viewport = createMockViewport(0, 0, 800, 600);
		const codeBlock = createMockCodeBlock(100, 200, 100, 100);

		expect(centerViewportOnCodeBlock(viewport, codeBlock).y).toBe(-48);
	});

	it('adds 25% viewport-height top margin for large blocks, rounded to rows', () => {
		const viewport = createMockViewport(0, 0, 800, 600);
		const codeBlock = createMockCodeBlock(100, 100, 100, 800);

		expect(centerViewportOnCodeBlock(viewport, codeBlock).y).toBe(-48);
	});

	it('keeps a rounded 25% viewport-height margin above a tall block at the origin', () => {
		const viewport = createMockViewport(0, 0, 800, 600);
		const codeBlock = createMockCodeBlock(0, 0, 100, 1000);

		expect(centerViewportOnCodeBlock(viewport, codeBlock).y).toBe(-144);
	});

	it('handles zero-sized blocks', () => {
		const viewport = createMockViewport(0, 0, 800, 600);
		const codeBlock = createMockCodeBlock(100, 100, 0, 0);

		expect(centerViewportOnCodeBlock(viewport, codeBlock)).toEqual({ x: -296, y: -192 });
	});

	it('handles blocks with negative coordinates', () => {
		const viewport = createMockViewport(0, 0, 800, 600);
		const codeBlock = createMockCodeBlock(-200, -100, 100, 100);

		expect(centerViewportOnCodeBlock(viewport, codeBlock)).toEqual({ x: -552, y: -352 });
	});

	it('keeps the rounded 25% viewport-height margin for oversized blocks in a very small viewport', () => {
		const viewport = createMockViewport(0, 0, 50, 50);
		const codeBlock = createMockCodeBlock(100, 100, 100, 100);

		expect(centerViewportOnCodeBlock(viewport, codeBlock)).toEqual({ x: 128, y: 80 });
	});

	it('does not mutate the provided viewport object', () => {
		const viewport = createMockViewport(999, 888, 800, 600);
		const codeBlock = createMockCodeBlock(100, 100, 200, 100);

		const originalViewport = viewport;
		const nextViewport = centerViewportOnCodeBlock(viewport, codeBlock);

		expect(viewport).toBe(originalViewport);
		expect(viewport.x).toBe(999);
		expect(viewport.y).toBe(888);
		expect(nextViewport).toEqual({ x: -200, y: -144 });
	});

	it('handles square viewport and square block', () => {
		const viewport = createMockViewport(0, 0, 600, 600);
		const codeBlock = createMockCodeBlock(400, 400, 200, 200);

		expect(centerViewportOnCodeBlock(viewport, codeBlock)).toEqual({ x: 200, y: 208 });
	});

	it('handles wide viewport and narrow block', () => {
		const viewport = createMockViewport(0, 0, 1200, 400);
		const codeBlock = createMockCodeBlock(100, 100, 50, 100);

		expect(centerViewportOnCodeBlock(viewport, codeBlock).x).toBe(-472);
	});

	it('handles tall viewport and short block', () => {
		const viewport = createMockViewport(0, 0, 400, 1000);
		const codeBlock = createMockCodeBlock(100, 100, 100, 50);

		expect(centerViewportOnCodeBlock(viewport, codeBlock).y).toBe(-368);
	});

	it('handles a typical desktop viewport', () => {
		const viewport = createMockViewport(0, 0, 1920, 1080);
		const codeBlock = createMockCodeBlock(500, 300, 400, 300);

		expect(centerViewportOnCodeBlock(viewport, codeBlock)).toEqual({ x: -256, y: -96 });
	});

	it('handles a mobile-sized viewport', () => {
		const viewport = createMockViewport(0, 0, 375, 667);
		const codeBlock = createMockCodeBlock(200, 200, 300, 400);

		expect(centerViewportOnCodeBlock(viewport, codeBlock)).toEqual({ x: 160, y: 64 });
	});

	it('always returns coordinates aligned to the viewport grid', () => {
		const viewport = createMockViewport(0, 0, 803, 607);
		const codeBlock = createMockCodeBlock(103, 207, 197, 99, 3, 5);

		const position = centerViewportOnCodeBlock(viewport, codeBlock);

		expect(Math.abs(position.x % viewport.vGrid)).toBe(0);
		expect(Math.abs(position.y % viewport.hGrid)).toBe(0);
	});
});
