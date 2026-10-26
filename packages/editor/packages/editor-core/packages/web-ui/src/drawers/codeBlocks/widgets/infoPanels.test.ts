import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, type vi } from 'vitest';
import { createDrawContextMock, createSpriteIdLookupMock } from '../../../__tests__/rendering';
import type { DrawContext as Engine } from '../../../drawContext';
import drawInfoPanels from './infoPanels';

function createMockEngine(): Engine {
	return createDrawContextMock();
}

describe('drawInfoPanels', () => {
	it('renders key value rows from state.info', () => {
		const engine = createMockEngine();
		const state = createMockState({
			info: {
				foo: {
					a: 1,
					bar: 'foo',
					skip: { nested: true },
					foo: 1.234567,
				},
			},
			spriteLookups: {
				fillColors: createSpriteIdLookupMock(),
				fontInkBase: createSpriteIdLookupMock(),
				fontMutedBase: createSpriteIdLookupMock(),
				fontPrimaryBase: createSpriteIdLookupMock(),
				fontSecondaryBase: createSpriteIdLookupMock(),
			} as never,
		});
		const codeBlock = createMockCodeBlock({
			widgets: {
				infoPanels: [{ x: 24, y: 32, width: 216, height: 48, id: 'foo', rowCount: 3, keyColumnWidth: 3 }],
			} as never,
		});

		drawInfoPanels(engine, state, codeBlock);

		const drawSprite = (engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite;
		const drawText = (engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText;

		expect(drawSprite).toHaveBeenCalledWith(0, 0, 'surfaceBase', 216, 48);
		expect(drawText).toHaveBeenCalledWith(0, 0, 'a', state.spriteLookups?.fontPrimaryBase);
		expect(drawText).toHaveBeenCalledWith(24, 0, ':', state.spriteLookups?.fontPrimaryBase);
		expect(drawText).toHaveBeenCalledWith(40, 0, '1', state.spriteLookups?.fontSecondaryBase);
		expect(drawText).toHaveBeenCalledWith(0, 32, 'foo', state.spriteLookups?.fontPrimaryBase);
		expect(drawText).toHaveBeenCalledWith(40, 32, '1.2346', state.spriteLookups?.fontSecondaryBase);
		expect(drawText).not.toHaveBeenCalledWith(0, 32, 'skip');
	});

	it('skips missing info records', () => {
		const engine = createMockEngine();
		const state = createMockState({
			spriteLookups: {
				fillColors: createSpriteIdLookupMock(),
				fontInkBase: createSpriteIdLookupMock(),
				fontMutedBase: createSpriteIdLookupMock(),
				fontPrimaryBase: createSpriteIdLookupMock(),
				fontSecondaryBase: createSpriteIdLookupMock(),
			} as never,
		});
		const codeBlock = createMockCodeBlock({
			widgets: {
				infoPanels: [{ x: 24, y: 32, width: 216, height: 48, id: 'missing', rowCount: 3, keyColumnWidth: 3 }],
			} as never,
		});

		drawInfoPanels(engine, state, codeBlock);

		const drawSprite = (engine as unknown as { drawSprite: ReturnType<typeof vi.fn> }).drawSprite;
		expect(drawSprite).not.toHaveBeenCalled();
	});

	it('does not render overflowing values when no value cells are available', () => {
		const engine = createMockEngine();
		const state = createMockState({
			info: {
				foo: {
					longKey: 'overflow',
				},
			},
			spriteLookups: {
				fillColors: createSpriteIdLookupMock(),
				fontInkBase: createSpriteIdLookupMock(),
				fontMutedBase: createSpriteIdLookupMock(),
				fontPrimaryBase: createSpriteIdLookupMock(),
				fontSecondaryBase: createSpriteIdLookupMock(),
			} as never,
		});
		const codeBlock = createMockCodeBlock({
			widgets: {
				infoPanels: [{ x: 24, y: 32, width: 72, height: 16, id: 'foo', rowCount: 1, keyColumnWidth: 7 }],
			} as never,
		});

		drawInfoPanels(engine, state, codeBlock);

		const drawText = (engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText;

		expect(drawText).toHaveBeenCalledWith(0, 0, 'longKey', state.spriteLookups?.fontPrimaryBase);
		expect(drawText).toHaveBeenCalledWith(56, 0, ':', state.spriteLookups?.fontPrimaryBase);
		expect(drawText).toHaveBeenCalledWith(72, 0, '', state.spriteLookups?.fontSecondaryBase);
		expect(drawText).not.toHaveBeenCalledWith(72, 0, 'overflow');
	});
});
