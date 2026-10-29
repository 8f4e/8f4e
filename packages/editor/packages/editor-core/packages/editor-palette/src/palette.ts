import type { Rgba } from './color.js';

export const BASE_COLORS = [
	'canvas',
	'surface',
	'ink',
	'muted',
	'primary',
	'secondary',
	'tertiary',
	'highlight',
	'detail',
	'stroke',
	'positive',
	'warning',
	'negative',
] as const;
export type BaseColor = (typeof BASE_COLORS)[number];
export type PaletteConfig = Partial<Record<BaseColor, string>>;
export const SHADE_AMOUNTS = [0.1, 0.25, 0.5, 0.75] as const;
export const SHADES = ['Dark4', 'Dark3', 'Dark2', 'Dark1', 'Base', 'Light1', 'Light2', 'Light3', 'Light4'] as const;
export const OPACITIES = [30, 60, 90] as const;
export type Shade = (typeof SHADES)[number];
export type ShadeToken = `${BaseColor}${Shade}`;
export type OpacityToken = `${BaseColor}Alpha${(typeof OPACITIES)[number]}`;
export const ALIASES = [
	'black',
	'white',
	'canvasDetail1',
	'canvasDetail2',
	'surfaceRaised1',
	'surfaceRaised2',
	'surfaceRaised3',
	'surfaceSubdued',
	'surfaceOverlay',
	'accentSurface',
	'inkStrong',
	'inkFaint',
	'mutedSoft',
	'secondarySoft',
	'secondaryReadable',
	'primarySoft',
	'primaryStrong',
	'inkOn',
	'negativeSurface',
	'negativeOn',
	'strokeStrong',
	'lightBase',
	'darkBase',
	'darkSurface',
	'onDarkAccent',
	'floatingSurface',
	'floatingInk',
	'floatingMuted',
	'floatingAccent',
	'selectionSurface',
	'selectionInk',
	'inverseSurface',
	'inverseInk',
	'inverseAccent',
	'positiveSoft',
	'negativeSoft',
	'scrim',
	'darkOverlaySoft',
	'primaryOverlay',
	'transparent',
] as const;
export type PaletteToken = ShadeToken | OpacityToken | (typeof ALIASES)[number];
export const PALETTE_TOKENS: readonly PaletteToken[] = [
	...BASE_COLORS.flatMap(base => SHADES.map(shade => `${base}${shade}` as ShadeToken)),
	...ALIASES,
	...BASE_COLORS.flatMap(base => OPACITIES.map(opacity => `${base}Alpha${opacity}` as OpacityToken)),
];
export type PaletteColors = Readonly<Record<PaletteToken, string>>;
export interface ResolvedPalette {
	readonly colors: PaletteColors;
	readonly rgba: Readonly<Record<PaletteToken, Rgba>>;
	readonly isDark: boolean;
}

export const defaultPalette = Object.freeze({
	canvas: 'transparent',
	surface: 'rgba(0,0,0,0.9)',
	ink: '#cccccc',
	primary: '#ffffff',
	positive: '#00ff00',
	warning: '#ffff00',
	negative: '#ff0000',
});

export type BaseColors = Readonly<Record<BaseColor, Rgba>>;
export type ShadeColors = Readonly<Record<ShadeToken | OpacityToken, Rgba>>;
export type MaterialToken = (typeof ALIASES)[number];
