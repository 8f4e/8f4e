import { type ALIASES, BASE_COLORS, type BaseColor, type PaletteToken } from './palette.js';

export type { Rgba } from './color.js';
export type {
	BaseColor,
	OpacityToken,
	PaletteColors,
	PaletteConfig,
	PaletteToken,
	ResolvedPalette,
	Shade,
	ShadeToken,
} from './palette.js';
export {
	ALIASES,
	BASE_COLORS,
	defaultPalette,
	OPACITIES,
	PALETTE_TOKENS,
	SHADE_AMOUNTS,
	SHADES,
} from './palette.js';
export { isPaletteColor, resolvePalette } from './resolvePalette.js';

export const FONT_SHADES = ['Dark2', 'Base', 'Light2'] as const;
// Bake foreground materials only; full font strips for fill materials would exceed the lookup texture budget.
export const FONT_ALIASES = [
	'black',
	'white',
	'inkFaint',
	'secondaryReadable',
	'primaryStrong',
	'inkOn',
	'negativeOn',
	'lightBase',
	'darkBase',
	'floatingInk',
	'floatingMuted',
	'floatingAccent',
	'selectionInk',
	'inverseInk',
	'inverseAccent',
	'darkOverlaySoft',
	'primaryOverlay',
] as const satisfies readonly (typeof ALIASES)[number][];
// Additional primary steps let drawers compose the six-state output indicator from ordinary glyphs.
const ADDITIONAL_FONT_TOKENS = ['primaryDark3', 'primaryDark1'] as const satisfies readonly PaletteToken[];
export type FontPaletteToken =
	| `${BaseColor}${(typeof FONT_SHADES)[number]}`
	| (typeof FONT_ALIASES)[number]
	| (typeof ADDITIONAL_FONT_TOKENS)[number];
export const FONT_PALETTE_TOKENS: readonly FontPaletteToken[] = [
	...BASE_COLORS.flatMap(base => FONT_SHADES.map(shade => `${base}${shade}` as FontPaletteToken)),
	...FONT_ALIASES,
	...ADDITIONAL_FONT_TOKENS,
];
