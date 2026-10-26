import type { SpriteCoordinates, SpriteId, SpriteLookup } from 'glugglugglug';
import { describe, expect, it } from 'vitest';

import { createSpriteAtlas, resolveSpriteIds } from '../src/index.ts';

describe('sprite atlas output', () => {
	it('flattens semantic groups into dense numeric sprite ids', () => {
		const image = {} as OffscreenCanvas;
		const red: SpriteCoordinates = { x: 0, y: 0, spriteWidth: 8, spriteHeight: 8 };
		const green: SpriteCoordinates = { x: 8, y: 0, spriteWidth: 8, spriteHeight: 8 };
		const atlas = createSpriteAtlas(image, {
			fontInkBase: { 65: red, A: red },
			fillColors: { foreground: red, background: green },
		});

		const compatibleLookup: SpriteLookup = atlas.lookup;
		expect(atlas.image).toBe(image);
		expect(compatibleLookup).toEqual({
			0: red,
			1: green,
		});
		expect(atlas.spriteIdentifiers).toEqual({
			fontInkBase: { 65: 0, A: 0 },
			fillColors: { foreground: 0, background: 1 },
		});
		const resolved = resolveSpriteIds(atlas.spriteIdentifiers, {
			resolveSprite: identifier => (Number(identifier) + 10) as SpriteId,
		});
		expect(resolved).toEqual({
			fontInkBase: { 65: 10, A: 10 },
			fillColors: { foreground: 10, background: 11 },
		});
	});

	it('copies coordinates into a deterministic lookup without mutating the grouped input', () => {
		const image = {} as OffscreenCanvas;
		const coordinates: SpriteCoordinates = { x: 3, y: 5, spriteWidth: 7, spriteHeight: 11 };
		const groupedLookups = { icons: { play: coordinates } };
		const first = createSpriteAtlas(image, groupedLookups);
		const second = createSpriteAtlas(image, groupedLookups);

		expect(second).toEqual(first);
		expect(first.lookup[0]).not.toBe(coordinates);
		expect(groupedLookups).toEqual({ icons: { play: coordinates } });
	});

	it('rejects invalid rectangles before assigning validated sprite ids', () => {
		const image = { width: 16, height: 8 } as OffscreenCanvas;

		expect(() =>
			createSpriteAtlas(image, {
				icons: { outside: { x: 12, y: 0, spriteWidth: 8, spriteHeight: 8 } },
			})
		).toThrow('Sprite icons.outside extends outside the atlas image.');
		expect(() =>
			createSpriteAtlas(image, {
				icons: { empty: { x: 0, y: 0, spriteWidth: 0, spriteHeight: 8 } },
			})
		).toThrow('Sprite icons.empty must have positive dimensions.');
	});
});
