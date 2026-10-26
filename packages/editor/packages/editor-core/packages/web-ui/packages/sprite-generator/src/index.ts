import type { SpriteId, SpriteLookup } from 'glugglugglug';
import { BACKGROUND_COLUMNS, BACKGROUND_ROWS, createAtlasLayout, FONT_COLUMNS } from './atlasLayout.ts';
import { writeGlyph } from './font.ts';
import decodeFontBase64 from './fonts/font-decoder.ts';
import type { FontMetadata } from './fonts/ibmvga8x16/generated/ascii.ts';
import type { SpriteAtlas } from './sprite-atlas.ts';
import { type Config, FONT_NAMES, type Font } from './types.ts';

export type { SpriteId } from 'glugglugglug';
export { BACKGROUND_COLUMNS, BACKGROUND_ROWS } from './atlasLayout.ts';
export type {
	SpriteAtlas,
	SpriteFont,
	SpriteIdentifierLookups,
	SpriteIdLookups,
} from './sprite-atlas.ts';
export { resolveSpriteIds } from './sprite-atlas.ts';
export type { Font } from './types.ts';
export { FONT_NAMES } from './types.ts';

type FontData = Omit<FontDefinition, 'loadMetadata'> & {
	asciiBitmap: number[];
};

type FontDefinition = {
	characterWidth: number;
	characterHeight: number;
	backgroundDot: { x: number; y: number; size: number };
	loadMetadata: () => Promise<{ fontMetadata: FontMetadata }>;
};

const FONT_DEFINITIONS: Record<Font, FontDefinition> = {
	attpc63008x16: {
		characterWidth: 8,
		characterHeight: 16,
		backgroundDot: { x: 3, y: 7, size: 2 },
		loadMetadata: () => import('./fonts/attpc63008x16/generated/ascii.ts'),
	},
	'6x10': {
		characterWidth: 6,
		characterHeight: 10,
		backgroundDot: { x: 1, y: 4, size: 2 },
		loadMetadata: () => import('./fonts/6x10/generated/ascii.ts'),
	},
	ibmvga8x16: {
		characterWidth: 8,
		characterHeight: 16,
		backgroundDot: { x: 3, y: 7, size: 2 },
		loadMetadata: () => import('./fonts/ibmvga8x16/generated/ascii.ts'),
	},
	nix8810m168x16: {
		characterWidth: 8,
		characterHeight: 16,
		backgroundDot: { x: 3, y: 7, size: 2 },
		loadMetadata: () => import('./fonts/nix8810m168x16/generated/ascii.ts'),
	},
	olivettithin8x16: {
		characterWidth: 8,
		characterHeight: 16,
		backgroundDot: { x: 3, y: 7, size: 2 },
		loadMetadata: () => import('./fonts/olivettithin8x16/generated/ascii.ts'),
	},
	spleen5x8: {
		characterWidth: 5,
		characterHeight: 8,
		backgroundDot: { x: 1, y: 4, size: 2 },
		loadMetadata: () => import('./fonts/spleen5x8/generated/ascii.ts'),
	},
	spleen6x12: {
		characterWidth: 6,
		characterHeight: 12,
		backgroundDot: { x: 1, y: 5, size: 2 },
		loadMetadata: () => import('./fonts/spleen6x12/generated/ascii.ts'),
	},
	spleen8x16: {
		characterWidth: 8,
		characterHeight: 16,
		backgroundDot: { x: 3, y: 7, size: 2 },
		loadMetadata: () => import('./fonts/spleen8x16/generated/ascii.ts'),
	},
	templeos8x8: {
		characterWidth: 8,
		characterHeight: 8,
		backgroundDot: { x: 2, y: 4, size: 2 },
		loadMetadata: () => import('./fonts/templeos8x8/generated/ascii.ts'),
	},
	spleen12x24: {
		characterWidth: 12,
		characterHeight: 24,
		backgroundDot: { x: 5, y: 11, size: 2 },
		loadMetadata: () => import('./fonts/spleen12x24/generated/ascii.ts'),
	},
	spleen16x32: {
		characterWidth: 16,
		characterHeight: 32,
		backgroundDot: { x: 6, y: 14, size: 4 },
		loadMetadata: () => import('./fonts/spleen16x32/generated/ascii.ts'),
	},
	terminus8x16: {
		characterWidth: 8,
		characterHeight: 16,
		backgroundDot: { x: 3, y: 7, size: 2 },
		loadMetadata: () => import('./fonts/terminus8x16/generated/ascii.ts'),
	},
	terminus8x16bold: {
		characterWidth: 8,
		characterHeight: 16,
		backgroundDot: { x: 3, y: 7, size: 2 },
		loadMetadata: () => import('./fonts/terminus8x16bold/generated/ascii.ts'),
	},
	terminus10x18: {
		characterWidth: 10,
		characterHeight: 18,
		backgroundDot: { x: 4, y: 8, size: 2 },
		loadMetadata: () => import('./fonts/terminus10x18/generated/ascii.ts'),
	},
	terminus10x18bold: {
		characterWidth: 10,
		characterHeight: 18,
		backgroundDot: { x: 4, y: 8, size: 2 },
		loadMetadata: () => import('./fonts/terminus10x18bold/generated/ascii.ts'),
	},
	kana12x13: {
		characterWidth: 12,
		characterHeight: 13,
		backgroundDot: { x: 4, y: 5, size: 2 },
		loadMetadata: () => import('./fonts/kana12x13/generated/ascii.ts'),
	},
	terminus12x24: {
		characterWidth: 12,
		characterHeight: 24,
		backgroundDot: { x: 5, y: 11, size: 2 },
		loadMetadata: () => import('./fonts/terminus12x24/generated/ascii.ts'),
	},
	terminus12x24bold: {
		characterWidth: 12,
		characterHeight: 24,
		backgroundDot: { x: 5, y: 11, size: 2 },
		loadMetadata: () => import('./fonts/terminus12x24bold/generated/ascii.ts'),
	},
};

function decodeFontData(metadata: FontMetadata, definition: FontDefinition): FontData {
	return {
		asciiBitmap: decodeFontBase64(metadata),
		characterWidth: definition.characterWidth,
		characterHeight: definition.characterHeight,
		backgroundDot: definition.backgroundDot,
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
	const { fontMetadata } = await definition.loadMetadata();
	const fontData = decodeFontData(fontMetadata, definition);

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

export interface SpriteData {
	spriteAtlas: SpriteAtlas;
	characterWidth: number;
	characterHeight: number;
}

export default async function generateSprite(config: Config = {}): Promise<SpriteData> {
	const { characterWidth, characterHeight, asciiBitmap, backgroundDot } = await loadFont(resolveFont(config.font));
	const layout = createAtlasLayout(characterWidth, characterHeight);
	const image = { width: layout.width, height: layout.height, data: new Uint8Array(layout.width * layout.height) };
	const lookup: SpriteLookup = {};
	const font: Record<number, number> & { 63: number } = { 63: 63 };
	for (let code = 0; code < 128; code++) {
		const x = (code % FONT_COLUMNS) * characterWidth;
		const y = Math.floor(code / FONT_COLUMNS) * characterHeight;
		writeGlyph(image.data, image.width, asciiBitmap, code, characterWidth, characterHeight, x, y);
		lookup[code] = { x, y, spriteWidth: characterWidth, spriteHeight: characterHeight };
		font[code] = code;
	}
	// Even columns form one color layer. Draw the same mask offset by one cell for odd columns.
	for (let row = 0; row < BACKGROUND_ROWS; row++) {
		for (let column = 0; column < BACKGROUND_COLUMNS; column += 2) {
			const x = column * characterWidth + backgroundDot.x;
			const y = layout.background.y + row * characterHeight + backgroundDot.y;
			for (let dotRow = 0; dotRow < backgroundDot.size; dotRow++) {
				const start = (y + dotRow) * image.width + x;
				image.data.fill(255, start, start + backgroundDot.size);
			}
		}
	}
	image.data[layout.fill.y * image.width + layout.fill.x] = 255;
	const fill = 128;
	const background = 129;
	lookup[fill] = layout.fill;
	lookup[background] = {
		x: 0,
		y: layout.background.y,
		spriteWidth: layout.background.width,
		spriteHeight: layout.background.height,
	};
	return {
		characterWidth,
		characterHeight,
		spriteAtlas: { image, lookup, spriteIdentifiers: { font, fill, background } },
	};
}
