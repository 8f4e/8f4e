import { describe, expect, it } from 'vitest';
import { composite, contrast, parseColor, rgb, toOklab } from './color';
import { BASE_COLORS, defaultPalette, isPaletteColor, PALETTE_TOKENS, resolvePalette, SHADES } from './index';

describe('editor palette', () => {
	it('preserves and normalizes anchors, with secondary following the selected primary', () => {
		const palette = resolvePalette({ primary: '#D9A6FF', canvas: '#609' });
		expect(palette.colors.primaryBase).toBe('#d9a6ff');
		expect(palette.colors.canvasBase).toBe('#660099');
		expect(palette.colors.secondaryBase).toBe('#d9a6ff');
		expect(resolvePalette({ primary: '#d9a6ff', secondary: '#f90' }).colors.secondaryBase).toBe('#ff9900');
		expect(defaultPalette.primary).toBe('#ffffff');
	});

	it('resolves omitted and explicitly supplied defaults identically', () => {
		const palette = resolvePalette();
		expect(resolvePalette(defaultPalette)).toEqual(palette);
		expect(resolvePalette({ primary: defaultPalette.primary })).toEqual(palette);
		expect(resolvePalette({ secondary: palette.colors.secondaryBase })).toEqual(palette);
	});

	it('inherits the secondary color and alpha for highlights unless explicitly configured', () => {
		const secondary = 'rgba(242,200,121,0.35)';
		const palette = resolvePalette({ secondary });
		expect(palette.rgba.highlightBase).toEqual(palette.rgba.secondaryBase);
		expect(palette.rgba.highlightLight2[3]).toBe(0.35);
		expect(resolvePalette({ secondary, highlight: 'rgba(255,255,255,0.45)' }).rgba.highlightBase).toEqual([
			1, 1, 1, 0.45,
		]);
	});

	it('produces a complete, deterministic catalog with matching sRGB and RGBA values', () => {
		const palette = resolvePalette();
		expect(Object.keys(palette.colors).sort()).toEqual([...PALETTE_TOKENS].sort());
		expect(palette).toEqual(resolvePalette());
		for (const token of PALETTE_TOKENS) {
			expect(palette.rgba[token].every(value => value >= 0 && value <= 1)).toBe(true);
			expect(palette.rgba[token]).toEqual(parseColor(palette.colors[token]));
		}
	});

	it.each(['#000', '#fff', '#f00', '#0f0', '#00f', '#d9a6ff', '#211307'])(
		'keeps shades ordered by perceived lightness for %s',
		color => {
			const palette = resolvePalette(Object.fromEntries(BASE_COLORS.map(base => [base, color])));
			for (const base of BASE_COLORS) {
				const levels = SHADES.map(shade => toOklab(rgb(palette.rgba[`${base}${shade}`]))[0]);
				for (let index = 1; index < levels.length; index++)
					expect(levels[index]).toBeGreaterThanOrEqual(levels[index - 1] - 0.002);
			}
		}
	);

	it.each([
		{ surface: '#1a0b24', ink: '#f6eff8', primary: '#d9a6ff' },
		{ surface: '#ffffff', ink: '#000000', primary: '#0000cc' },
		{ surface: '#777777', ink: '#eeeeee', primary: '#888888' },
		{ surface: '#666666', ink: '#cccccc', primary: '#888888' },
	])('selects readable secondary and on-ink colors once for %o', config => {
		const { rgba } = resolvePalette(config);
		expect(contrast(rgb(rgba.secondaryReadable), rgb(rgba.surfaceBase))).toBeGreaterThanOrEqual(4.5);
		expect(contrast(rgb(rgba.inkOn), rgb(rgba.inkBase))).toBeGreaterThanOrEqual(4.5);
	});

	it('keeps muted ink as a separate anchor and uses dark visualizer surfaces in light themes', () => {
		const palette = resolvePalette({
			surface: '#f6f5fa',
			ink: '#35405c',
			muted: '#8b93a8',
			primary: '#4c60b4',
			warning: '#d6a748',
		});
		expect(palette.colors.mutedBase).toBe('#8b93a8');
		expect(toOklab(rgb(palette.rgba.darkSurface))[0]).toBeLessThan(0.35);
		expect(toOklab(rgb(palette.rgba.inverseSurface))[0]).toBeLessThan(0.4);
		expect(contrast(rgb(palette.rgba.inverseInk), rgb(palette.rgba.inverseSurface))).toBeGreaterThanOrEqual(4.5);
	});

	it('preserves source alpha in base colors and their shades, with fixed opacity variants available', () => {
		const palette = resolvePalette({ canvas: 'transparent', surface: '#000e', stroke: 'rgba(69,89,160,0.38)' });
		expect(palette.rgba.canvasBase[3]).toBe(0);
		expect(palette.rgba.surfaceBase[3]).toBeCloseTo(14 / 15);
		expect(palette.rgba.strokeBase).toEqual([69 / 255, 89 / 255, 160 / 255, 0.38]);
		expect(palette.rgba.strokeDark2[3]).toBe(0.38);
		expect(palette.rgba.strokeAlpha60[3]).toBe(0.6);
		expect(palette.rgba.strokeStrong[3]).toBe(1);
		expect(parseColor('#12345678')[3]).toBeCloseTo(120 / 255);
	});

	it('derives materials from a translucent panel over its canvas and preserves muted alpha', () => {
		const palette = resolvePalette({
			canvas: '#3399cc',
			surface: 'rgba(255,255,255,0.2)',
			ink: '#ccc',
			primary: '#fff',
			muted: 'rgba(255,255,255,0.3)',
		});
		expect(palette.isDark).toBe(true);
		expect(palette.rgba.surfaceRaised1[2]).toBeGreaterThan(palette.rgba.surfaceRaised1[0]);
		expect(palette.rgba.mutedBase[3]).toBe(0.3);
		expect(palette.rgba.inkFaint[3]).toBe(0.3);
		expect(palette.colors.onDarkAccent).toBe(palette.colors.primaryBase);
		expect(palette.colors.primaryStrong).toBe(palette.colors.primaryBase);
		expect(palette.rgba.surfaceBase).toEqual([1, 1, 1, 0.2]);
	});

	it('selects readable text against the composited translucent surface', () => {
		const palette = resolvePalette({ canvas: '#fff', surface: 'rgba(0,0,0,0.1)', ink: '#000', primary: '#bbb' });
		const background = composite(palette.rgba.surfaceBase, palette.rgba.canvasBase);
		expect(
			contrast(rgb(composite(palette.rgba.secondaryReadable, background)), rgb(background))
		).toBeGreaterThanOrEqual(4.5);
	});

	it('keeps transparency separate from opaque shade generation', () => {
		const palette = resolvePalette({ primary: '#ff0000' });
		expect(palette.rgba.primaryOverlay).toEqual([1, 0, 0, 0.7]);
		expect(palette.rgba.darkOverlaySoft[3]).toBe(0.35);
		expect(palette.rgba.transparent).toEqual([0, 0, 0, 0]);
	});

	it.each(['#12', '#12345', 'red', 'rgba(0,0,0,2)', 'rgb(256,0,0)', '#ggg'])('rejects invalid anchors: %s', value => {
		expect(isPaletteColor(value)).toBe(false);
		expect(() => resolvePalette({ primary: value })).toThrow('Invalid palette color');
	});

	it('rejects feature keys instead of retaining a legacy override layer', () => {
		expect(() => resolvePalette({ fill: {} } as never)).toThrow("Unknown palette color 'fill'");
	});
});
