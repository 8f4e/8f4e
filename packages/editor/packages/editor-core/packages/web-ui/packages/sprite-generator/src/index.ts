import { type ResolvedPalette, resolvePalette } from '@8f4e/editor-palette';
import type { SpriteCoordinates, SpriteId, SpriteIdentifier } from 'glugglugglug';
import { createAtlasLayout } from './atlasLayout.ts';
import generateBackground, { generateLookup as generateLookupForBackground } from './background.ts';
import generateFeedbackScale, { generateLookup as generateLookupForFeedbackScale } from './feedbackScale.ts';
import type { FillSpriteColorName } from './fillColors.ts';
import generateFillColors, { generateLookup as generateLookupForFillColors } from './fillColors.ts';
import generateFont, { type FontLookups, generateLookups as generateLookupsForFonts } from './font.ts';
import decodeFontBase64 from './fonts/font-decoder.ts';
import type { FontMetadata } from './fonts/ibmvga8x16/generated/ascii.ts';
import generateIcons, { generateLookup as generateLookupForIcons, type IconValue } from './icons.ts';
import {
	createSpriteAtlas,
	type SpriteAtlas,
	type SpriteIdentifierLookup,
	type SpriteIdentifiers,
	type SpriteIdLookup,
	type SpriteIds,
} from './sprite-atlas.ts';
import { Command, type Config, FONT_NAMES, type Font } from './types.ts';

export type { SpriteId } from 'glugglugglug';
export type { FillSpriteColorName } from './fillColors.ts';
export { Icon } from './icons.ts';
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

interface AtlasCoordinates extends FontLookups {
	fillColors: Record<FillSpriteColorName, SpriteCoordinates>;
	background: Record<0, SpriteCoordinates>;
	icons: Record<IconValue, SpriteCoordinates>;
	feedbackScale: Partial<Record<number, SpriteCoordinates>>;
}

/** Validated fixed-cell font whose fallback glyph is guaranteed to exist. */
export type SpriteFont = SpriteIdLookup & { readonly 63: SpriteId };

/** Validated feedback scale whose neutral fallback sprite is guaranteed to exist. */
export type SpriteFeedbackScale = SpriteIdLookup & { readonly 0: SpriteId };

type NonFontAtlasCoordinates = Omit<AtlasCoordinates, keyof FontLookups>;

type SpriteIdentifierFont = SpriteIdentifierLookup & { readonly 63: SpriteIdentifier };
type SpriteIdentifierFeedbackScale = SpriteIdentifierLookup & { readonly 0: SpriteIdentifier };

/** Grouped public identifiers emitted with a generated atlas and resolved when that atlas is installed. */
export type SpriteIdentifierLookups = Omit<SpriteIdentifiers<NonFontAtlasCoordinates>, 'feedbackScale'> & {
	feedbackScale: SpriteIdentifierFeedbackScale;
} & {
	[Group in keyof FontLookups]: SpriteIdentifierFont;
};

/** Grouped numeric sprite identifiers used by the editor render hot path. */
export type SpriteIdLookups = Omit<SpriteIds<NonFontAtlasCoordinates>, 'feedbackScale'> & {
	feedbackScale: SpriteFeedbackScale;
} & {
	[Group in keyof FontLookups]: SpriteFont;
};

export default async function generateSprite(config: Config): Promise<{
	spriteAtlas: SpriteAtlas<SpriteIdentifierLookups>;
	characterWidth: number;
	characterHeight: number;
	palette: ResolvedPalette;
}> {
	const { characterWidth, characterHeight, asciiBitmap, glyphsBitmap } = await loadFont(resolveFont(config.font));
	const palette = resolvePalette(config.palette);
	const layout = createAtlasLayout(characterWidth, characterHeight, palette.colors);
	const canvas = new OffscreenCanvas(layout.canvasWidth, layout.canvasHeight);

	const ctx = canvas.getContext('2d', {
		alpha: true,
		antialias: false,
	}) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

	const commands = [
		...generateFillColors(characterWidth, characterHeight, palette.colors),
		...generateFeedbackScale(asciiBitmap, characterWidth, characterHeight, palette.colors),
		...generateFont(asciiBitmap, characterWidth, characterHeight, palette.colors),
		...generateBackground(glyphsBitmap, characterWidth, characterHeight, palette.colors),
		...generateIcons(asciiBitmap, characterWidth, characterHeight, palette.colors),
	];

	commands.forEach(([command, ...params]) => {
		switch (command) {
			case Command.FILL_COLOR:
				ctx.fillStyle = <string>params[0];
				break;
			case Command.RECTANGLE:
				ctx.fillRect(...(params as [number, number, number, number]));
				break;
			case Command.SAVE:
				ctx.save();
				break;
			case Command.RESET_TRANSFORM:
				ctx.resetTransform();
				break;
			case Command.RESTORE:
				ctx.restore();
				break;
			case Command.TRANSLATE:
				ctx.translate(...(params as [number, number]));
				break;
			case Command.PIXEL:
				ctx.fillRect(...(params as [number, number]), 1, 1);
				break;
		}
	});

	const atlasCoordinates: AtlasCoordinates = {
		fillColors: generateLookupForFillColors(characterWidth, characterHeight, palette.colors),
		...generateLookupsForFonts(characterWidth, characterHeight, palette.colors),
		feedbackScale: generateLookupForFeedbackScale(characterWidth, characterHeight, palette.colors),
		background: generateLookupForBackground(characterWidth, characterHeight, palette.colors),
		icons: generateLookupForIcons(characterWidth, characterHeight, palette.colors),
	};
	const rawSpriteAtlas = createSpriteAtlas(canvas, atlasCoordinates);
	const spriteAtlas: SpriteAtlas<SpriteIdentifierLookups> = {
		...rawSpriteAtlas,
		spriteIdentifiers: validateSpriteIdentifiers(rawSpriteAtlas.spriteIdentifiers),
	};

	return {
		characterHeight,
		characterWidth,
		spriteAtlas,
		palette,
	};
}

/**
 * Strengthens generated lookup groups after confirming that their required fallback sprites exist.
 *
 * @param spriteIdentifiers - Public atlas lookups produced from validated source rectangles.
 * @returns The same lookups with required font and feedback fallbacks reflected in their types.
 */
function validateSpriteIdentifiers(spriteIdentifiers: SpriteIdentifiers<AtlasCoordinates>): SpriteIdentifierLookups {
	for (const [groupName, group] of Object.entries(spriteIdentifiers)) {
		if (groupName.startsWith('font') && (group as SpriteIdentifierLookup)[63] === undefined) {
			throw new Error(`Generated sprite font ${groupName} is missing fallback glyph 63.`);
		}
	}
	if (spriteIdentifiers.feedbackScale[0] === undefined) {
		throw new Error('Generated feedback scale is missing fallback sprite 0.');
	}
	return spriteIdentifiers as SpriteIdentifierLookups;
}
