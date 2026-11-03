import { PALETTE_TOKENS, type PaletteToken, type ResolvedPalette } from './palette.js';

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

/** Stable within the token catalog; equal colors retain separate indices across theme changes. */
export type PaletteIndex = number;
export const PALETTE_INDICES: Readonly<Record<PaletteToken, PaletteIndex>> = Object.freeze(
	Object.fromEntries(PALETTE_TOKENS.map((token, index) => [token, index])) as Record<PaletteToken, PaletteIndex>
);

/** Encode straight-alpha normalized palette values for the renderer's generic RGBA8 table. */
export function toPaletteBytes(palette: ResolvedPalette): Uint8Array {
	return Uint8Array.from(PALETTE_TOKENS.flatMap(token => palette.rgba[token].map(value => Math.round(value * 255))));
}
