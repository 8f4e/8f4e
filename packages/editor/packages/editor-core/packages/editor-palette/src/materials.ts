import { BLACK, composite, contrast, gamutMap, mix, normalizeColor, type Rgba, rgb, toOklab, WHITE } from './color.js';
import {
	type BaseColors,
	type MaterialToken,
	type PaletteToken,
	SHADES,
	type ShadeColors,
	type ShadeToken,
} from './palette.js';

export interface PaletteTheme {
	readonly background: Rgba;
	readonly visibleInk: Rgba;
	readonly isDark: boolean;
	readonly primaryChroma: number;
	readonly surfaceChroma: number;
}

const SATURATED_SURFACE_CHROMA = 0.12;
const TEXT_CONTRAST = 4.5;
const opaque = (color: Rgba): Rgba => [...rgb(color), 1];
const lightness = (color: Rgba) => toOklab(rgb(color))[0];

export function resolveMaterials(
	bases: BaseColors,
	shades: ShadeColors,
	theme: PaletteTheme
): Record<PaletteToken, Rgba> {
	const values = { ...shades } as Record<PaletteToken, Rgba>;
	const { background, visibleInk, isDark } = theme;
	const { primary, muted } = bases;
	const lighter = isDark ? visibleInk : background;
	const darker = isDark ? background : visibleInk;
	const onBase = (base: 'primary' | 'ink' | 'negative') =>
		contrasting(composite(values[`${base}Base`], background), [
			values.surfaceBase,
			values.inkBase,
			values.lightBase,
			values.darkBase,
			WHITE,
			BLACK,
		]);

	// Evaluate in declaration order: dependent materials follow the materials they use.
	const rules: Record<MaterialToken, () => Rgba> = {
		black: () => BLACK,
		white: () => WHITE,
		transparent: () => [0, 0, 0, 0],
		canvasDetail1: () => canvasDetail(bases, theme, 0),
		canvasDetail2: () => canvasDetail(bases, theme, 1),
		surfaceRaised1: () => raisedSurface(bases, theme, 0),
		surfaceRaised2: () => raisedSurface(bases, theme, 1),
		surfaceRaised3: () => raisedSurface(bases, theme, 2),
		inkMuted: () => values.mutedBase,
		inkSoft: () => softInk(bases, theme),
		inkFaint: () => mix(muted, background, 0.45, muted[3]),
		primaryReadable: () => readable('primary', background, shades),
		secondaryReadable: () => readable('secondary', background, shades),
		primarySoft: () => mix(background, primary, isDark ? 0.4 : 0.12, 1),
		primaryStrong: () => (isDark ? values.primaryBase : values.primaryDark2),
		lightBase: () => (lightness(lighter) >= 0.8 ? opaque(lighter) : WHITE),
		darkBase: () => (lightness(darker) <= 0.4 ? opaque(darker) : BLACK),
		darkSurface: () => (isDark ? mix(background, BLACK, 0.1, 1) : mix(visibleInk, BLACK, 0.25, 1)),
		onDarkAccent: () =>
			isDark
				? values.primaryBase
				: contrasting(values.darkSurface, [
						values.primaryBase,
						values.secondaryBase,
						values.warningBase,
						values.lightBase,
						WHITE,
					]),
		floatingSurface: () => floatingSurface(bases, theme, values),
		floatingInk: () => contrasting(values.floatingSurface, [values.inkBase, values.lightBase, values.darkBase]),
		floatingMuted: () => mix(values.floatingInk, values.floatingSurface, 0.3, 1),
		floatingAccent: () =>
			contrasting(values.floatingSurface, [values.primaryBase, values.warningBase, values.floatingInk]),
		selectionSurface: () =>
			contrastOn(values.primaryBase, values.floatingSurface) >= 2 ? values.primaryBase : values.lightBase,
		selectionInk: () =>
			contrasting(values.selectionSurface, [values.surfaceBase, values.inkBase, values.primaryBase, BLACK, WHITE]),
		inverseSurface: () => (isDark ? mix(values.lightBase, primary, 0.15, 1) : mix(visibleInk, BLACK, 0.1, 1)),
		inverseInk: () => contrasting(values.inverseSurface, [values.darkBase, values.lightBase, WHITE, BLACK]),
		inverseAccent: () =>
			contrasting(
				values.inverseSurface,
				isDark
					? [values.primaryDark2, values.primaryDark3, values.darkBase]
					: [values.warningBase, values.secondaryBase, values.lightBase]
			),
		positiveSoft: () => (isDark ? values.positiveLight2 : values.positiveDark2),
		negativeSoft: () => (isDark ? values.negativeLight2 : values.negativeDark2),
		primaryOn: () => onBase('primary'),
		inkOn: () => onBase('ink'),
		negativeOn: () => onBase('negative'),
		strokeStrong: () => opaque(isDark ? values.strokeLight2 : values.strokeBase),
		darkOverlay: () => [...rgb(values.darkBase), 0.7],
		darkOverlaySoft: () => [...rgb(values.darkBase), 0.35],
		primaryOverlay: () => [...rgb(primary), 0.7],
	};
	for (const [token, rule] of Object.entries(rules)) values[token as MaterialToken] = normalizeColor(rule());
	return values;
}

function canvasDetail(bases: BaseColors, theme: PaletteTheme, level: 0 | 1): Rgba {
	const [l, a, b] = toOklab(rgb(bases.canvas));
	if (l < 0.05 && Math.hypot(a, b) < 0.01) return mix(bases.canvas, bases.primary, level === 0 ? 0.5 : 0.35, 1);
	const offset = [0.08, 0.18][level];
	return [...gamutMap([Math.max(0, Math.min(1, l + (theme.isDark ? offset : -offset))), a, b]), 1];
}

function raisedSurface(bases: BaseColors, theme: PaletteTheme, level: 0 | 1 | 2): Rgba {
	const amount = (theme.isDark ? [0.15, 0.25, 0.35] : [0.05, 0.1, 0.15])[level];
	// Saturated dark surfaces retain their own hue; other surfaces gain an accent tint.
	const tint = theme.isDark && theme.surfaceChroma > SATURATED_SURFACE_CHROMA ? BLACK : bases.primary;
	return mix(theme.background, tint, amount, 1);
}

function softInk(bases: BaseColors, theme: PaletteTheme): Rgba {
	const { muted, ink } = bases;
	if (theme.isDark) return mix(muted, ink, 0.2, muted[3]);
	if (lightness(muted) < 0.55) return mix(muted, theme.background, 0.5, muted[3]);
	return mix(muted, ink, 0.15, muted[3]);
}

function floatingSurface(bases: BaseColors, theme: PaletteTheme, values: Record<PaletteToken, Rgba>): Rgba {
	if (theme.isDark)
		return mix(theme.background, bases.primary, theme.surfaceChroma > SATURATED_SURFACE_CHROMA ? 0 : 0.2, 1);
	// Neutral light themes with a strong accent use an accented floating surface.
	if (theme.surfaceChroma < 0.01 && theme.primaryChroma > 0.15) return opaque(values.primaryDark1);
	return values.surfaceRaised2;
}

function contrastOn(front: Rgba, back: Rgba): number {
	return contrast(rgb(composite(front, back)), rgb(back));
}

function contrasting(back: Rgba, candidates: readonly Rgba[]): Rgba {
	return (
		candidates.find(color => contrastOn(color, back) >= TEXT_CONTRAST) ??
		[...candidates, BLACK, WHITE].sort((a, b) => contrastOn(b, back) - contrastOn(a, back))[0]
	);
}

function readable(base: 'primary' | 'secondary', back: Rgba, shades: ShadeColors): Rgba {
	const baseLightness = lightness(shades[`${base}Base`]);
	const candidates = SHADES.map(shade => shades[`${base}${shade}` as ShadeToken]).sort(
		(a, b) => Math.abs(lightness(a) - baseLightness) - Math.abs(lightness(b) - baseLightness)
	);
	return contrasting(back, candidates);
}
