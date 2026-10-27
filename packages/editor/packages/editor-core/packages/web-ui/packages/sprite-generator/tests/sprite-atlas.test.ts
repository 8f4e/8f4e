import { describe, expect, it } from 'vitest';
import generateSprite from '../src/index.ts';

describe('sprite atlas output', () => {
	it('uses row-major glyph and fill indices directly without rectangle metadata or resolution', async () => {
		const { spriteAtlas } = await generateSprite();
		expect(spriteAtlas.sprites.font[0]).toBe(0);
		expect(spriteAtlas.sprites.font[63]).toBe(63);
		expect(spriteAtlas.sprites.font[127]).toBe(127);
		expect(spriteAtlas.sprites.fill).toBe(128);
		expect(Object.keys(spriteAtlas.sprites.font)).toHaveLength(128);
		expect(spriteAtlas.grid).toEqual({ cellWidth: 8, cellHeight: 16, columns: 16, cellCount: 129 });
	});
});
