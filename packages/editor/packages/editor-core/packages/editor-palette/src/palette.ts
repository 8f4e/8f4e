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

/*!
 * Accent colors adapted from Catppuccin Mocha: https://github.com/catppuccin/palette
 * MIT License
 * Copyright (c) 2021 Catppuccin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
export const defaultPalette = Object.freeze({
	canvas: '#060606',
	surface: '#101010',
	ink: '#e3e3e3',
	muted: '#909090',
	primary: '#cba6f7',
	secondary: '#fab387',
	tertiary: '#7f849c',
	highlight: '#94e2d5',
	detail: '#f5c2e7',
	stroke: '#858585',
	positive: '#a6e3a1',
	warning: '#f9e2af',
	negative: '#f38ba8',
} satisfies Record<BaseColor, string>);

export type BaseColors = Readonly<Record<BaseColor, Rgba>>;
export type ShadeColors = Readonly<Record<ShadeToken | OpacityToken, Rgba>>;
export type MaterialToken = (typeof ALIASES)[number];
