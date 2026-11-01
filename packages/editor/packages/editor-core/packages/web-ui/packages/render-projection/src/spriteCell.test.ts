import type { SpriteId } from 'glugglugglug';
import { expect, it } from 'vitest';
import { createSpriteCell } from './spriteCell';

it('keeps packed text cells unsigned and preserves zero-valued shapes and colors', () => {
	expect(createSpriteCell(0 as SpriteId, 0)).toBe(0);
	expect(createSpriteCell(0xffff as SpriteId, 0xffff)).toBe(0xffffffff);
	expect(createSpriteCell(42 as SpriteId, 7) & 0xffff).toBe(42);
	expect(createSpriteCell(42 as SpriteId, 7) >>> 16).toBe(7);
});
