/**
 * Bundled fonts, attribution and fixed-cell dimensions; bitmap payloads remain lazy.
 * Credits follow editor-core's THIRD_PARTY_FONTS.md and bundled license notices.
 */
export const FONT_CATALOG = {
	x11miscfixed6x10: {
		name: 'X11 Misc Fixed 6x10',
		credits: 'X11 font contributors / Markus Kuhn\nPublic domain',
		width: 6,
		height: 10,
		load: () => import('../generated/x11miscfixed6x10.ts'),
	},
	olivettithin8x16: {
		name: 'Olivetti Thin 8x16',
		credits: 'VileR / Oldschool PC Font Pack\nCC BY-SA 4.0',
		width: 8,
		height: 16,
		load: () => import('../generated/olivettithin8x16.ts'),
	},
	spleen5x8: {
		name: 'Spleen 5x8',
		credits: 'Frederic Cambus\nBSD 2-Clause',
		width: 5,
		height: 8,
		load: () => import('../generated/spleen5x8.ts'),
	},
	spleen6x12: {
		name: 'Spleen 6x12',
		credits: 'Frederic Cambus\nBSD 2-Clause',
		width: 6,
		height: 12,
		load: () => import('../generated/spleen6x12.ts'),
	},
	ibmvga8x16: {
		name: 'IBM VGA 8x16',
		credits: 'VileR / Oldschool PC Font Pack\nCC BY-SA 4.0',
		width: 8,
		height: 16,
		load: () => import('../generated/ibmvga8x16.ts'),
	},
	spleen8x16: {
		name: 'Spleen 8x16',
		credits: 'Frederic Cambus\nBSD 2-Clause',
		width: 8,
		height: 16,
		load: () => import('../generated/spleen8x16.ts'),
	},
	templeos8x8: {
		name: 'TempleOS 8x8',
		credits: 'Terry A. Davis\nBitmap conversion by Rendello',
		width: 8,
		height: 8,
		load: () => import('../generated/templeos8x8.ts'),
	},
	terminus8x16: {
		name: 'Terminus 8x16',
		credits: 'Dimitar Toshkov Zhekov\nSIL OFL 1.1',
		width: 8,
		height: 16,
		load: () => import('../generated/terminus8x16.ts'),
	},
	terminus8x16bold: {
		name: 'Terminus 8x16 Bold',
		credits: 'Dimitar Toshkov Zhekov\nSIL OFL 1.1',
		width: 8,
		height: 16,
		load: () => import('../generated/terminus8x16bold.ts'),
	},
	terminus10x18: {
		name: 'Terminus 10x18',
		credits: 'Dimitar Toshkov Zhekov\nSIL OFL 1.1',
		width: 10,
		height: 18,
		load: () => import('../generated/terminus10x18.ts'),
	},
	kana12x13: {
		name: 'Kana 12x13',
		credits: 'Based on Cozette by Ines\nMIT',
		width: 12,
		height: 13,
		load: () => import('../generated/kana12x13.ts'),
	},
	terminus12x24: {
		name: 'Terminus 12x24',
		credits: 'Dimitar Toshkov Zhekov\nSIL OFL 1.1',
		width: 12,
		height: 24,
		load: () => import('../generated/terminus12x24.ts'),
	},
	terminus12x24bold: {
		name: 'Terminus 12x24 Bold',
		credits: 'Dimitar Toshkov Zhekov\nSIL OFL 1.1',
		width: 12,
		height: 24,
		load: () => import('../generated/terminus12x24bold.ts'),
	},
	spleen16x32: {
		name: 'Spleen 16x32',
		credits: 'Frederic Cambus\nBSD 2-Clause',
		width: 16,
		height: 32,
		load: () => import('../generated/spleen16x32.ts'),
	},
	startrek25th8x9: {
		name: 'Star Trek 25th Anniversary 8x9',
		credits: 'Patrick H. Lauke\nCC BY 3.0',
		width: 8,
		height: 9,
		load: () => import('../generated/startrek25th8x9.ts'),
	},
	dilithiumpixels7x10: {
		name: 'Dilithium Pixels NBP 7x10',
		credits: 'Nate Halley\nCC BY-SA 3.0',
		width: 7,
		height: 10,
		load: () => import('../generated/dilithiumpixels7x10.ts'),
	},
	departuremono7x14: {
		name: 'Departure Mono 14',
		credits: 'Helena Zhang\nSIL OFL 1.1',
		width: 7,
		height: 14,
		load: () => import('../generated/departuremono7x14.ts'),
	},
	pixelcode6x12: {
		name: 'PixelCode 6x12',
		credits: 'Qwerasd\nSIL OFL 1.1',
		width: 6,
		height: 12,
		load: () => import('../generated/pixelcode6x12.ts'),
	},
	eaglespcgaalt38x8: {
		name: 'EagleSpCGA Alt3 8x8',
		credits: 'VileR / Oldschool PC Font Pack\nCC BY-SA 4.0',
		width: 8,
		height: 8,
		load: () => import('../generated/eaglespcgaalt38x8.ts'),
	},
	sergamon8x16: {
		name: 'Sergamon 8x16',
		credits: 'Sergamon Contributors\nSIL OFL 1.1',
		width: 8,
		height: 16,
		load: () => import('../generated/sergamon8x16.ts'),
	},
	scientifica5x11: {
		name: 'Scientifica 5x11',
		credits: 'Akshay Oppiliappan\nBased on Creep, Creep2 and Lemon\nSIL OFL 1.1',
		width: 5,
		height: 11,
		load: () => import('../generated/scientifica5x11.ts'),
	},
} as const;

export type Font = keyof typeof FONT_CATALOG;
/** Font names ordered by increasing pixel-cell area, retaining catalog order for equal sizes. */
export const FONT_NAMES: readonly Font[] = (Object.keys(FONT_CATALOG) as Font[]).sort((a, b) => {
	const first = FONT_CATALOG[a];
	const second = FONT_CATALOG[b];
	return first.width * first.height - second.width * second.height;
});
export const DEFAULT_FONT: Font = 'ibmvga8x16';
