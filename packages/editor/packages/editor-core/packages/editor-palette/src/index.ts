import { composite, contrast, gamutMap, mix, parseColor, type Rgba, rgb, toHex, toOklab } from './color.js';

export type { Rgba } from './color.js';
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
	'inkMuted',
	'inkSoft',
	'inkFaint',
	'primaryReadable',
	'secondaryReadable',
	'primarySoft',
	'primaryStrong',
	'primaryOn',
	'inkOn',
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
	'darkOverlay',
	'darkOverlaySoft',
	'primaryOverlay',
	'transparent',
] as const;
export type PaletteToken = ShadeToken | OpacityToken | (typeof ALIASES)[number];
export const FONT_SHADES = ['Dark2', 'Base', 'Light2'] as const;
// Bake foreground materials only; full font strips for fill materials would exceed the lookup texture budget.
export const FONT_ALIASES = [
	'black',
	'white',
	'inkMuted',
	'inkSoft',
	'inkFaint',
	'primaryReadable',
	'secondaryReadable',
	'primaryStrong',
	'primaryOn',
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
export type FontPaletteToken = `${BaseColor}${(typeof FONT_SHADES)[number]}` | (typeof FONT_ALIASES)[number];
export const FONT_PALETTE_TOKENS: readonly FontPaletteToken[] = [
	...BASE_COLORS.flatMap(base => FONT_SHADES.map(shade => `${base}${shade}` as FontPaletteToken)),
	...FONT_ALIASES,
];
// Extra opacity swatches are fill-only; duplicating full fonts for them exceeds the renderer's lookup budget.
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

export function isPaletteColor(value: string): boolean {
	try {
		parseColor(value);
		return true;
	} catch {
		return false;
	}
}

/** Resolve the finite color catalog before atlas generation, including source alpha. */
export function resolvePalette(config: PaletteConfig = {}): ResolvedPalette {
	for (const key of Object.keys(config))
		if (!BASE_COLORS.includes(key as BaseColor)) throw new TypeError(`Unknown palette color '${key}'.`);
	const input = { ...defaultPalette, ...config };
	const surface = parseColor(input.surface);
	const ink = parseColor(input.ink);
	const primary = parseColor(input.primary);
	const black: Rgba = [0, 0, 0, 1];
	const white: Rgba = [1, 1, 1, 1];
	const background = composite(surface, composite(parseColor(input.canvas), black));
	const visibleInk = composite(ink, background);
	const isDark = toOklab(rgb(background))[0] < toOklab(rgb(visibleInk))[0];
	const primaryChroma = Math.hypot(...toOklab(rgb(primary)).slice(1));
	const muted = config.muted
		? parseColor(config.muted)
		: mix(primaryChroma > 0.02 ? mix(ink, primary, 0.5) : ink, background, 0.2, 1);
	const bases: Record<BaseColor, Rgba> = {
		...Object.fromEntries(Object.entries(input).map(([key, value]) => [key, parseColor(value)])),
		secondary: parseColor(config.secondary ?? input.primary),
		muted,
		tertiary: config.tertiary ? parseColor(config.tertiary) : mix(muted, background, 0.25, muted[3]),
		highlight: parseColor(config.highlight ?? config.secondary ?? config.primary ?? 'rgba(255,255,255,0.45)'),
		detail: parseColor(config.detail ?? input.primary),
		stroke: config.stroke ? parseColor(config.stroke) : [...rgb(primary), 0.3],
	} as Record<BaseColor, Rgba>;
	const colors = {} as Record<PaletteToken, string>;
	const rgba = {} as Record<PaletteToken, Rgba>;
	const set = (token: PaletteToken, color: Rgba) => {
		const hex = toHex(rgb(color));
		const canonical = parseColor(hex);
		rgba[token] = [...rgb(canonical), color[3]];
		colors[token] =
			color[3] === 1
				? hex
				: `rgba(${rgb(canonical)
						.map(value => Math.round(value * 255))
						.join(',')},${Number(color[3].toFixed(6))})`;
	};
	const opaque = (color: Rgba): Rgba => [...rgb(color), 1];
	for (const base of BASE_COLORS) {
		const color = bases[base];
		const [l, a, b] = toOklab(rgb(color));
		set(`${base}Base`, color);
		for (const [index, amount] of SHADE_AMOUNTS.entries()) {
			// Retain chroma when darkening; gamut mapping reduces it only where necessary.
			set(`${base}Dark${index + 1}` as ShadeToken, [...gamutMap([l * (1 - amount), a, b]), color[3]]);
			set(`${base}Light${index + 1}` as ShadeToken, [
				...gamutMap([l + (1 - l) * amount, a * (1 - amount), b * (1 - amount)]),
				color[3],
			]);
		}
		for (const opacity of OPACITIES) set(`${base}Alpha${opacity}`, [...rgb(color), opacity / 100]);
	}
	set('black', black);
	set('white', white);
	set('transparent', [0, 0, 0, 0]);
	const alias = (token: PaletteToken, source: PaletteToken) => set(token, rgba[source]);
	const lab = (token: PaletteToken) => toOklab(rgb(rgba[token]));
	const ratio = (front: Rgba, back: Rgba) => contrast(rgb(composite(front, back)), rgb(back));
	const contrasting = (back: Rgba, candidates: readonly PaletteToken[]): PaletteToken =>
		candidates.find(token => ratio(rgba[token], back) >= 4.5) ??
		[...candidates, 'black' as const, 'white' as const].sort((a, b) => ratio(rgba[b], back) - ratio(rgba[a], back))[0];
	const readable = (base: 'primary' | 'secondary', back: Rgba): PaletteToken => {
		const candidates = SHADES.map(shade => `${base}${shade}` as ShadeToken).sort(
			(a, b) => Math.abs(lab(a)[0] - lab(`${base}Base`)[0]) - Math.abs(lab(b)[0] - lab(`${base}Base`)[0])
		);
		return contrasting(back, candidates);
	};
	for (const [index, offset] of [0.08, 0.18].entries()) {
		const [l, a, b] = toOklab(rgb(bases.canvas));
		if (l < 0.05 && Math.hypot(a, b) < 0.01) {
			set(`canvasDetail${index + 1}` as PaletteToken, mix(bases.canvas, primary, index === 0 ? 0.5 : 0.35, 1));
			continue;
		}
		set(`canvasDetail${index + 1}` as PaletteToken, [
			...gamutMap([Math.max(0, Math.min(1, l + (isDark ? offset : -offset))), a, b]),
			1,
		]);
	}
	const surfaceChroma = Math.hypot(...toOklab(rgb(background)).slice(1));
	for (const [index, amount] of (isDark ? [0.15, 0.25, 0.35] : [0.05, 0.1, 0.15]).entries()) {
		// Saturated surfaces keep their own hue; subdued surfaces gain an accent tint.
		const color =
			isDark && surfaceChroma > 0.12 ? mix(background, black, amount, 1) : mix(background, primary, amount, 1);
		set(`surfaceRaised${index + 1}` as PaletteToken, color);
	}
	alias('inkMuted', 'mutedBase');
	const mutedLightness = toOklab(rgb(muted))[0];
	set(
		'inkSoft',
		isDark
			? mix(muted, ink, 0.2, muted[3])
			: mutedLightness < 0.55
				? mix(muted, background, 0.5, muted[3])
				: mix(muted, ink, 0.15, muted[3])
	);
	set('inkFaint', mix(muted, background, 0.45, muted[3]));
	alias('primaryReadable', readable('primary', background));
	alias('secondaryReadable', readable('secondary', background));
	set('primarySoft', mix(background, primary, isDark ? 0.4 : 0.12, 1));
	alias('primaryStrong', isDark ? 'primaryBase' : 'primaryDark2');
	const lighter: Rgba = isDark ? visibleInk : background;
	const darker: Rgba = isDark ? background : visibleInk;
	set('lightBase', toOklab(rgb(lighter))[0] >= 0.8 ? opaque(lighter) : white);
	set('darkBase', toOklab(rgb(darker))[0] <= 0.4 ? opaque(darker) : black);
	set('darkSurface', isDark ? mix(background, black, 0.1, 1) : mix(visibleInk, black, 0.25, 1));
	alias(
		'onDarkAccent',
		isDark
			? 'primaryBase'
			: contrasting(rgba.darkSurface, ['primaryBase', 'secondaryBase', 'warningBase', 'lightBase', 'white'])
	);
	const retroLight = !isDark && surfaceChroma < 0.01 && primaryChroma > 0.15;
	set(
		'floatingSurface',
		retroLight
			? opaque(rgba.primaryDark1)
			: isDark
				? mix(background, primary, surfaceChroma > 0.12 ? 0 : 0.2, 1)
				: rgba.surfaceRaised2
	);
	alias('floatingInk', contrasting(rgba.floatingSurface, ['inkBase', 'lightBase', 'darkBase']));
	set('floatingMuted', mix(rgba.floatingInk, rgba.floatingSurface, 0.3, 1));
	alias('floatingAccent', contrasting(rgba.floatingSurface, ['primaryBase', 'warningBase', 'floatingInk']));
	alias('selectionSurface', ratio(rgba.primaryBase, rgba.floatingSurface) >= 2 ? 'primaryBase' : 'lightBase');
	alias(
		'selectionInk',
		contrasting(rgba.selectionSurface, ['surfaceBase', 'inkBase', 'primaryBase', 'black', 'white'])
	);
	set('inverseSurface', isDark ? mix(rgba.lightBase, primary, 0.15, 1) : mix(visibleInk, black, 0.1, 1));
	alias('inverseInk', contrasting(rgba.inverseSurface, ['darkBase', 'lightBase', 'white', 'black']));
	alias(
		'inverseAccent',
		isDark
			? contrasting(rgba.inverseSurface, ['primaryDark2', 'primaryDark3', 'darkBase'])
			: contrasting(rgba.inverseSurface, ['warningBase', 'secondaryBase', 'lightBase'])
	);
	alias('positiveSoft', isDark ? 'positiveLight2' : 'positiveDark2');
	alias('negativeSoft', isDark ? 'negativeLight2' : 'negativeDark2');
	for (const base of ['primary', 'ink', 'negative'] as const)
		alias(
			`${base}On`,
			contrasting(composite(rgba[`${base}Base`], background), [
				'surfaceBase',
				'inkBase',
				'lightBase',
				'darkBase',
				'white',
				'black',
			])
		);
	set('strokeStrong', opaque(isDark ? rgba.strokeLight2 : rgba.strokeBase));
	set('darkOverlay', [...rgb(rgba.darkBase), 0.7]);
	set('darkOverlaySoft', [...rgb(rgba.darkBase), 0.35]);
	set('primaryOverlay', [...rgb(primary), 0.7]);
	return { colors, rgba, isDark };
}
