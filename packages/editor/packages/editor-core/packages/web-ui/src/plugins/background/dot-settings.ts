import type { Font } from '@8f4e/sprite-generator';

/** Pixel-aligned dot bounds within each font cell. */
export const BACKGROUND_DOTS = {
	x11miscfixed6x10: { x: 1, y: 4, size: 2 },
	startrek25th8x9: { x: 3, y: 3, size: 2 },
	dilithiumpixels7x10: { x: 2, y: 4, size: 2 },
	departuremono7x14: { x: 2, y: 6, size: 2 },
	pixelcode6x12: { x: 2, y: 5, size: 2 },
	eaglespcgaalt38x8: { x: 3, y: 3, size: 2 },
	sergamon8x16: { x: 3, y: 7, size: 2 },
	scientifica5x11: { x: 1, y: 4, size: 2 },
	ibmvga8x16: { x: 3, y: 7, size: 2 },
	olivettithin8x16: { x: 3, y: 7, size: 2 },
	spleen5x8: { x: 1, y: 4, size: 2 },
	spleen6x12: { x: 1, y: 5, size: 2 },
	spleen8x16: { x: 3, y: 7, size: 2 },
	templeos8x8: { x: 2, y: 4, size: 2 },
	spleen16x32: { x: 6, y: 14, size: 4 },
	terminus8x16: { x: 3, y: 7, size: 2 },
	terminus8x16bold: { x: 3, y: 7, size: 2 },
	terminus10x18: { x: 4, y: 8, size: 2 },
	kana12x13: { x: 4, y: 5, size: 2 },
	terminus12x24: { x: 5, y: 11, size: 2 },
	terminus12x24bold: { x: 5, y: 11, size: 2 },
} satisfies Record<Font, { readonly x: number; readonly y: number; readonly size: number }>;
