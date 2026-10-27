import type { SpriteAtlasGrid, SpriteAtlasImage, SpriteId } from 'glugglugglug';

/** Fixed-cell glyph IDs, shared by all palette colors. */
export type SpriteFont = Readonly<Partial<Record<number, SpriteId>>> & { readonly 63: SpriteId };

export interface SpriteIdLookups {
	font: SpriteFont;
	fill: SpriteId;
}

export interface SpriteAtlas {
	image: SpriteAtlasImage;
	grid: SpriteAtlasGrid;
	sprites: SpriteIdLookups;
}
