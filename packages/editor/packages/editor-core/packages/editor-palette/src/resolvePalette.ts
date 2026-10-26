import {
	BLACK,
	composite,
	formatColor,
	gamutMap,
	mix,
	normalizeColor,
	parseColor,
	type Rgba,
	rgb,
	toOklab,
} from './color.js';
import { type PaletteTheme, resolveMaterials } from './materials.js';
import {
	BASE_COLORS,
	type BaseColors,
	defaultPalette,
	OPACITIES,
	type PaletteColors,
	type PaletteConfig,
	type ResolvedPalette,
	SHADE_AMOUNTS,
	type ShadeColors,
	type ShadeToken,
} from './palette.js';

export function isPaletteColor(value: string): boolean {
	try {
		parseColor(value);
		return true;
	} catch {
		return false;
	}
}

/** Resolve colors independently of font coverage and atlas layout. */
export function resolvePalette(config: PaletteConfig = {}): ResolvedPalette {
	const { bases, theme } = resolveBaseColors(config);
	const shades = generateShades(bases);
	const rgba = resolveMaterials(bases, shades, theme);
	const colors = Object.fromEntries(
		Object.entries(rgba).map(([token, color]) => [token, formatColor(color)])
	) as PaletteColors;
	return { colors, rgba, isDark: theme.isDark };
}

function resolveBaseColors(config: PaletteConfig): { bases: BaseColors; theme: PaletteTheme } {
	for (const key of Object.keys(config))
		if (!BASE_COLORS.includes(key as (typeof BASE_COLORS)[number]))
			throw new TypeError(`Unknown palette color '${key}'.`);
	const input = { ...defaultPalette, ...config };
	const parsed = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, parseColor(value)])) as Record<
		keyof typeof defaultPalette,
		Rgba
	> &
		Partial<BaseColors>;
	const { canvas, surface, ink, primary } = parsed;
	const background = composite(surface, composite(canvas, BLACK));
	const visibleInk = composite(ink, background);
	const primaryChroma = chroma(primary);
	const theme: PaletteTheme = {
		background,
		visibleInk,
		isDark: toOklab(rgb(background))[0] < toOklab(rgb(visibleInk))[0],
		primaryChroma,
		surfaceChroma: chroma(background),
	};
	const muted = parsed.muted ?? mix(primaryChroma > 0.02 ? mix(ink, primary, 0.5) : ink, background, 0.2, 1);
	const secondary = parsed.secondary ?? primary;
	const bases: BaseColors = {
		...parsed,
		muted,
		secondary,
		tertiary: parsed.tertiary ?? mix(muted, background, 0.25, muted[3]),
		highlight: parsed.highlight ?? secondary,
		detail: parsed.detail ?? primary,
		stroke: parsed.stroke ?? [...rgb(primary), 0.3],
	};
	return { bases, theme };
}

function chroma(color: Rgba): number {
	return Math.hypot(...toOklab(rgb(color)).slice(1));
}

function generateShades(bases: BaseColors): ShadeColors {
	const shades = {} as Record<keyof ShadeColors, Rgba>;
	for (const base of BASE_COLORS) {
		const color = bases[base];
		const [l, a, b] = toOklab(rgb(color));
		shades[`${base}Base`] = normalizeColor(color);
		for (const [index, amount] of SHADE_AMOUNTS.entries()) {
			// Retain chroma when darkening; gamut mapping reduces it only where necessary.
			shades[`${base}Dark${index + 1}` as ShadeToken] = normalizeColor([
				...gamutMap([l * (1 - amount), a, b]),
				color[3],
			]);
			shades[`${base}Light${index + 1}` as ShadeToken] = normalizeColor([
				...gamutMap([l + (1 - l) * amount, a * (1 - amount), b * (1 - amount)]),
				color[3],
			]);
		}
		for (const opacity of OPACITIES) shades[`${base}Alpha${opacity}`] = normalizeColor([...rgb(color), opacity / 100]);
	}
	return shades;
}
