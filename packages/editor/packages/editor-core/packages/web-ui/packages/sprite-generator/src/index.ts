import type { SpriteAtlasGrid, SpriteAtlasImage, SpriteId } from 'glugglugglug';
import { createAtlasLayout, FONT_COLUMNS, GLYPH_COUNT } from './atlasLayout.ts';
import { writeGlyph } from './font.ts';
import { DEFAULT_FONT, FONTS, type Font } from './fonts/catalog.ts';
import decodeFontBase64 from './fonts/font-decoder.ts';

export type { SpriteId } from 'glugglugglug';
export { DEFAULT_FONT, FONT_NAMES, type Font } from './fonts/catalog.ts';

export const FILL_SPRITE_ID = GLYPH_COUNT as SpriteId;

/** Bundled glyph IDs match ASCII character codes; unsupported characters use the question mark. */
export function getGlyphSpriteId(character: number): SpriteId {
	return (character >= 0 && character < GLYPH_COUNT ? character : 63) as SpriteId;
}

export interface FontAtlas {
	image: SpriteAtlasImage;
	grid: SpriteAtlasGrid;
}

const fontCache: Partial<Record<Font, Promise<FontAtlas>>> = {};

/** Loads and expands each bundled font once. All fonts share the same glyph and fill cell IDs. */
export default function loadFontAtlas(font: Font = DEFAULT_FONT): Promise<FontAtlas> {
	return (fontCache[font] ??= buildFontAtlas(font));
}

async function buildFontAtlas(font: Font): Promise<FontAtlas> {
	const { width, height, load } = FONTS[font];
	const { default: base64 } = await load();
	const bitmap = decodeFontBase64(base64, width > 8 ? 2 : 1);
	const layout = createAtlasLayout(width, height);
	const image = { width: layout.width, height: layout.height, data: new Uint8Array(layout.width * layout.height) };
	for (let code = 0; code < GLYPH_COUNT; code++) {
		writeGlyph(
			image.data,
			image.width,
			bitmap,
			code,
			width,
			height,
			(code % FONT_COLUMNS) * width,
			Math.floor(code / FONT_COLUMNS) * height
		);
	}
	for (let row = 0; row < height; row++) {
		const start = (layout.fill.y + row) * image.width + layout.fill.x;
		image.data.fill(255, start, start + width);
	}
	return { image, grid: { cellWidth: width, cellHeight: height, columns: FONT_COLUMNS, cellCount: GLYPH_COUNT + 1 } };
}
