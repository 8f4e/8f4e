import type { SpriteId } from 'glugglugglug';
import { describe, expect, it } from 'vitest';
import generateSprite, { resolveSpriteIds } from '../src/index.ts';

describe('sprite atlas output', () => {
	it('resolves glyph, fill, and background identifiers through the installed atlas', async () => {
		const { spriteAtlas } = await generateSprite();
		const identifiers = spriteAtlas.spriteIdentifiers;
		const resolved = resolveSpriteIds(identifiers, {
			resolveSprite: identifier => (Number(identifier) + 1000) as SpriteId,
		});
		expect(resolved.font[0]).toBe(1000);
		expect(resolved.font[63]).toBe(1063);
		expect(resolved.font[127]).toBe(1127);
		expect(resolved.fill).toBe(1128);
		expect(resolved.background).toBe(1129);
		expect(Object.keys(resolved.font)).toHaveLength(128);
		expect(identifiers.fill).toBe(128);
	});
});
