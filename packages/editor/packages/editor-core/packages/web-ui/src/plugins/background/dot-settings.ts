import type { Font } from '@8f4e/sprite-generator';

/** Pixel-aligned dot bounds within each font cell. */
export const BACKGROUND_DOTS = {
	attpc63008x16: { x: 3, y: 7, size: 2 },
	'6x10': { x: 1, y: 4, size: 2 },
	ibmvga8x16: { x: 3, y: 7, size: 2 },
	nix8810m168x16: { x: 3, y: 7, size: 2 },
	olivettithin8x16: { x: 3, y: 7, size: 2 },
	spleen5x8: { x: 1, y: 4, size: 2 },
	spleen6x12: { x: 1, y: 5, size: 2 },
	spleen8x16: { x: 3, y: 7, size: 2 },
	templeos8x8: { x: 2, y: 4, size: 2 },
	spleen12x24: { x: 5, y: 11, size: 2 },
	spleen16x32: { x: 6, y: 14, size: 4 },
	terminus8x16: { x: 3, y: 7, size: 2 },
	terminus8x16bold: { x: 3, y: 7, size: 2 },
	terminus10x18: { x: 4, y: 8, size: 2 },
	terminus10x18bold: { x: 4, y: 8, size: 2 },
	kana12x13: { x: 4, y: 5, size: 2 },
	terminus12x24: { x: 5, y: 11, size: 2 },
	terminus12x24bold: { x: 5, y: 11, size: 2 },
} satisfies Record<Font, { readonly x: number; readonly y: number; readonly size: number }>;
