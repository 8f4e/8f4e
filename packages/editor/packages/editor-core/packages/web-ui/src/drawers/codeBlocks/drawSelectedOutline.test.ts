import { createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';
import { createDrawContextMock, createSpriteIdLookupMock } from '../../__tests__/rendering';
import drawSelectedOutline from './drawSelectedOutline';

describe('drawSelectedOutline', () => {
	it.each([
		{ width: 96, height: 64, vGrid: 8, hGrid: 16, loopDurationMs: 2160 },
		{ width: 48, height: 24, vGrid: 6, hGrid: 12, loopDurationMs: 1520 },
	])('loops around a $width by $height block with a $vGrid by $hGrid font grid', options => {
		const state = createMockState({
			viewport: { vGrid: options.vGrid, hGrid: options.hGrid },
			spriteLookups: { fontSecondaryBase: createSpriteIdLookupMock() } as never,
		});
		const engine = createDrawContextMock();
		const drawText = vi.mocked(engine.drawText);

		drawSelectedOutline(engine, state, options.width, options.height, 0);
		const initialOutline = [...drawText.mock.calls];
		expect(initialOutline).toHaveLength(4);

		drawText.mockClear();
		drawSelectedOutline(engine, state, options.width, options.height, 80);
		expect(drawText.mock.calls).not.toEqual(initialOutline);

		drawText.mockClear();
		drawSelectedOutline(engine, state, options.width, options.height, options.loopDurationMs);
		expect(drawText.mock.calls).toEqual(initialOutline);
	});
});
