import { type ResolvedPalette, resolvePalette } from '@8f4e/editor-palette';
import type { SpriteCoordinates, SpriteId, SpriteIdentifier } from 'glugglugglug';
import { BACKGROUND_COLUMNS, BACKGROUND_ROWS, createAtlasLayout, FONT_COLUMNS } from './atlasLayout.ts';
import { writeGlyph } from './font.ts';
import decodeFontBase64 from './fonts/font-decoder.ts';
import type { FontMetadata } from './fonts/ibmvga8x16/generated/ascii.ts';
import Glyph from './fonts/types.ts';
import { createSpriteAtlas, type SpriteAtlas } from './sprite-atlas.ts';
import { type Config, FONT_NAMES, type Font } from './types.ts';

export type { SpriteId } from 'glugglugglug';
export { BACKGROUND_COLUMNS, BACKGROUND_ROWS } from './atlasLayout.ts';
export type {
	ResolvedSpriteIds,
	SpriteAtlas,
	SpriteIdentifierLookup,
	SpriteIdentifiers,
	SpriteIdLookup,
	SpriteIds,
} from './sprite-atlas.ts';
export { createSpriteAtlas, resolveSpriteIds } from './sprite-atlas.ts';
export type { Font } from './types.ts';
export { FONT_NAMES } from './types.ts';

type FontData = {
	asciiBitmap: number[];
	glyphsBitmap: number[];
	characterWidth: number;
	characterHeight: number;
};

type FontMetadataSet = {
	asciiMetadata: FontMetadata;
	glyphsMetadata: FontMetadata;
};

type FontDefinition = {
	characterWidth: number;
	characterHeight: number;
	loadMetadata: () => Promise<FontMetadataSet>;
};

const FONT_DEFINITIONS: Record<Font, FontDefinition> = {
	attpc63008x16: {
		characterWidth: 8,
		characterHeight: 16,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/attpc63008x16/generated/ascii.ts'),
				import('./fonts/attpc63008x16/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	'6x10': {
		characterWidth: 6,
		characterHeight: 10,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/6x10/generated/ascii.ts'),
				import('./fonts/6x10/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	ibmvga8x16: {
		characterWidth: 8,
		characterHeight: 16,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/ibmvga8x16/generated/ascii.ts'),
				import('./fonts/ibmvga8x16/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	nix8810m168x16: {
		characterWidth: 8,
		characterHeight: 16,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/nix8810m168x16/generated/ascii.ts'),
				import('./fonts/nix8810m168x16/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	olivettithin8x16: {
		characterWidth: 8,
		characterHeight: 16,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/olivettithin8x16/generated/ascii.ts'),
				import('./fonts/olivettithin8x16/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	spleen5x8: {
		characterWidth: 5,
		characterHeight: 8,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/spleen5x8/generated/ascii.ts'),
				import('./fonts/spleen5x8/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	spleen6x12: {
		characterWidth: 6,
		characterHeight: 12,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/spleen6x12/generated/ascii.ts'),
				import('./fonts/spleen6x12/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	spleen8x16: {
		characterWidth: 8,
		characterHeight: 16,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/spleen8x16/generated/ascii.ts'),
				import('./fonts/spleen8x16/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	templeos8x8: {
		characterWidth: 8,
		characterHeight: 8,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/templeos8x8/generated/ascii.ts'),
				import('./fonts/templeos8x8/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	spleen12x24: {
		characterWidth: 12,
		characterHeight: 24,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/spleen12x24/generated/ascii.ts'),
				import('./fonts/spleen12x24/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	spleen16x32: {
		characterWidth: 16,
		characterHeight: 32,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/spleen16x32/generated/ascii.ts'),
				import('./fonts/spleen16x32/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	terminus8x16: {
		characterWidth: 8,
		characterHeight: 16,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/terminus8x16/generated/ascii.ts'),
				import('./fonts/terminus8x16/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	terminus8x16bold: {
		characterWidth: 8,
		characterHeight: 16,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/terminus8x16bold/generated/ascii.ts'),
				import('./fonts/terminus8x16bold/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	terminus10x18: {
		characterWidth: 10,
		characterHeight: 18,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/terminus10x18/generated/ascii.ts'),
				import('./fonts/terminus10x18/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	terminus10x18bold: {
		characterWidth: 10,
		characterHeight: 18,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/terminus10x18bold/generated/ascii.ts'),
				import('./fonts/terminus10x18bold/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	kana12x13: {
		characterWidth: 12,
		characterHeight: 13,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/kana12x13/generated/ascii.ts'),
				import('./fonts/kana12x13/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	terminus12x24: {
		characterWidth: 12,
		characterHeight: 24,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/terminus12x24/generated/ascii.ts'),
				import('./fonts/terminus12x24/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
	terminus12x24bold: {
		characterWidth: 12,
		characterHeight: 24,
		loadMetadata: async () => {
			const [{ fontMetadata: asciiMetadata }, { fontMetadata: glyphsMetadata }] = await Promise.all([
				import('./fonts/terminus12x24bold/generated/ascii.ts'),
				import('./fonts/terminus12x24bold/generated/glyphs.ts'),
			]);

			return { asciiMetadata, glyphsMetadata };
		},
	},
};

function decodeFontData({ asciiMetadata, glyphsMetadata }: FontMetadataSet, definition: FontDefinition): FontData {
	return {
		asciiBitmap: decodeFontBase64(asciiMetadata),
		glyphsBitmap: decodeFontBase64(glyphsMetadata),
		characterWidth: definition.characterWidth,
		characterHeight: definition.characterHeight,
	};
}

// Fonts are loaded on first use and cached so each bitmap is decoded at most once.
const fontCache: Partial<Record<Font, FontData>> = {};

export const DEFAULT_FONT: Font = 'ibmvga8x16';

function resolveFont(font: Config['font']): Font {
	return FONT_NAMES.includes(font as Font) ? (font as Font) : DEFAULT_FONT;
}

async function loadFont(font: Font): Promise<FontData> {
	if (fontCache[font]) {
		return fontCache[font]!;
	}

	const definition = FONT_DEFINITIONS[font];
	const metadata = await definition.loadMetadata();
	const fontData = decodeFontData(metadata, definition);

	fontCache[font] = fontData;
	return fontData;
}

declare const spriteCellBrand: unique symbol;
/** Compact pre-resolved cell: low 16 bits are the glyph ID, high 16 bits are the palette index. */
export type SpriteCell = number & { readonly [spriteCellBrand]: true };

/** Packs validated shape/color selections outside the render loop without allocating an object per glyph. */
export function createSpriteCell(spriteId: SpriteId, paletteIndex: number): SpriteCell {
	return (((paletteIndex << 16) | spriteId) >>> 0) as SpriteCell;
}

/** Fixed-cell glyph IDs, shared by all palette colors. */
export type SpriteFont = Readonly<Partial<Record<number, SpriteId>>> & { readonly 63: SpriteId };
export type SpriteIdentifierLookups = {
	font: Partial<Record<number, SpriteIdentifier>> & { readonly 63: SpriteIdentifier };
	fill: { readonly 0: SpriteIdentifier };
	background: { readonly 0: SpriteIdentifier };
};
export type SpriteIdLookups = {
	font: SpriteFont;
	fill: { readonly 0: SpriteId };
	background: { readonly 0: SpriteId };
};

export default async function generateSprite(config: Config = {}): Promise<{
	spriteAtlas: SpriteAtlas<SpriteIdentifierLookups>;
	characterWidth: number;
	characterHeight: number;
	palette: ResolvedPalette;
}> {
	const { characterWidth, characterHeight, asciiBitmap, glyphsBitmap } = await loadFont(resolveFont(config.font));
	const layout = createAtlasLayout(characterWidth, characterHeight);
	const image = { width: layout.width, height: layout.height, data: new Uint8Array(layout.width * layout.height) };
	const font: Record<number, SpriteCoordinates> = {};
	for (let code = 0; code < 128; code++) {
		const x = (code % FONT_COLUMNS) * characterWidth;
		const y = Math.floor(code / FONT_COLUMNS) * characterHeight;
		writeGlyph(image.data, image.width, asciiBitmap, code, characterWidth, characterHeight, x, y);
		font[code] = { x, y, spriteWidth: characterWidth, spriteHeight: characterHeight };
	}
	// Even columns form one color layer. Draw the same mask offset by one cell for odd columns.
	for (let row = 0; row < BACKGROUND_ROWS; row++) {
		for (let column = 0; column < BACKGROUND_COLUMNS; column += 2) {
			writeGlyph(
				image.data,
				image.width,
				glyphsBitmap,
				Glyph.DOT,
				characterWidth,
				characterHeight,
				column * characterWidth,
				layout.background.y + row * characterHeight
			);
		}
	}
	image.data[layout.fill.y * image.width + layout.fill.x] = 255;
	const spriteAtlas = createSpriteAtlas(image, {
		font,
		fill: { 0: layout.fill },
		background: {
			0: { x: 0, y: layout.background.y, spriteWidth: layout.background.width, spriteHeight: layout.background.height },
		},
	});
	return {
		characterWidth,
		characterHeight,
		palette: resolvePalette(config.palette),
		spriteAtlas: spriteAtlas as SpriteAtlas<SpriteIdentifierLookups>,
	};
}
