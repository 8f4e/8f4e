import type { SpriteId } from 'glugglugglug';

declare const spriteCellBrand: unique symbol;
/** Compact text cell: low 16 bits are the glyph ID, high 16 bits are the palette index. */
export type SpriteCell = number & { readonly [spriteCellBrand]: true };

export function createSpriteCell(spriteId: SpriteId, paletteIndex: number): SpriteCell {
	return (((paletteIndex << 16) | spriteId) >>> 0) as SpriteCell;
}
