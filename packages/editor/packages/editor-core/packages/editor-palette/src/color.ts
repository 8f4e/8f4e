/** Opaque sRGB and Oklab triples. Conversion matrices follow CSS Color 4. */
export type Triple = [number, number, number];
export type Rgba = readonly [number, number, number, number];

export const BLACK: Rgba = [0, 0, 0, 1];
export const WHITE: Rgba = [1, 1, 1, 1];

/** Match the atlas's eight-bit RGB channels while preserving the authored alpha. */
export function normalizeColor(color: Rgba): Rgba {
	return [...rgb(parseColor(toHex(rgb(color)))), color[3]];
}

export function formatColor(color: Rgba): string {
	return color[3] === 1
		? toHex(rgb(color))
		: `rgba(${rgb(color)
				.map(value => Math.round(value * 255))
				.join(',')},${Number(color[3].toFixed(6))})`;
}

/** Parse the portable palette syntax without relying on a browser CSS parser. */
export function parseColor(color: string): Rgba {
	if (color === 'transparent') return [0, 0, 0, 0];
	if (/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(color)) {
		const hex = color.length <= 5 ? [...color.slice(1)].map(value => value + value).join('') : color.slice(1);
		const channels = [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as Triple;
		return [...channels, hex.length === 8 ? Number.parseInt(hex.slice(6), 16) / 255 : 1];
	}
	const match = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(color);
	if (match) {
		const channels = match.slice(1, 4).map(Number);
		const alpha = match[4] === undefined ? 1 : Number(match[4]);
		if (
			channels.every(value => Number.isFinite(value) && value >= 0 && value <= 255) &&
			Number.isFinite(alpha) &&
			alpha >= 0 &&
			alpha <= 1
		) {
			return [channels[0] / 255, channels[1] / 255, channels[2] / 255, alpha];
		}
	}
	throw new TypeError(`Invalid palette color '${color}': expected hex, rgb(), rgba(), or transparent.`);
}

export function rgb(color: Rgba): Triple {
	return [color[0], color[1], color[2]];
}

export function mix(
	first: Rgba,
	second: Rgba,
	amount: number,
	alpha = first[3] * (1 - amount) + second[3] * amount
): Rgba {
	const a = toOklab(rgb(first));
	const b = toOklab(rgb(second));
	return [...gamutMap(a.map((value, index) => value + (b[index] - value) * amount) as Triple), alpha];
}

/** Standard source-over compositing, used when selecting readable colors. */
export function composite(front: Rgba, back: Rgba): Rgba {
	const alpha = front[3] + back[3] * (1 - front[3]);
	if (alpha === 0) return [0, 0, 0, 0];
	return [
		...(rgb(front).map(
			(value, index) => (value * front[3] + back[index] * back[3] * (1 - front[3])) / alpha
		) as Triple),
		alpha,
	];
}

export function parseHex(color: string): Triple {
	if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color)) {
		throw new TypeError(`Invalid palette color '${color}': expected opaque #rgb or #rrggbb.`);
	}
	const hex = color.length === 4 ? [...color.slice(1)].map(value => value + value).join('') : color.slice(1);
	return [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as Triple;
}

export function toHex(rgb: Triple): string {
	return `#${rgb
		.map(value =>
			Math.round(Math.max(0, Math.min(1, value)) * 255)
				.toString(16)
				.padStart(2, '0')
		)
		.join('')}`;
}

function linear(value: number): number {
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function encoded(value: number): number {
	return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}

export function toOklab(rgb: Triple): Triple {
	const [r, g, b] = rgb.map(linear);
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

function fromOklab([lightness, a, b]: Triple): Triple {
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	].map(encoded) as Triple;
}

/** Preserve lightness and hue, reducing chroma only when a shade is outside sRGB. */
export function gamutMap(lab: Triple): Triple {
	const inGamut = (rgb: Triple) => rgb.every(value => value >= -0.000001 && value <= 1.000001);
	const original = fromOklab(lab);
	if (inGamut(original)) return original;
	let low = 0;
	let high = 1;
	for (let iteration = 0; iteration < 24; iteration++) {
		const scale = (low + high) / 2;
		if (inGamut(fromOklab([lab[0], lab[1] * scale, lab[2] * scale]))) low = scale;
		else high = scale;
	}
	return fromOklab([lab[0], lab[1] * low, lab[2] * low]);
}

export function contrast(first: Triple, second: Triple): number {
	const luminance = (rgb: Triple) => {
		const [r, g, b] = rgb.map(linear);
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const a = luminance(first);
	const b = luminance(second);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
