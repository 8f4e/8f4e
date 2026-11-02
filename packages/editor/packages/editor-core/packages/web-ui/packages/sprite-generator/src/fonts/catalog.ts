/** Bundled fixed-cell fonts. Build tooling reads dimensions without loading bitmap payloads. */
export const FONTS = {
	attpc63008x16: { width: 8, height: 16, load: () => import('../generated/attpc63008x16.ts') },
	'6x10': { width: 6, height: 10, load: () => import('../generated/6x10.ts') },
	nix8810m168x16: { width: 8, height: 16, load: () => import('../generated/nix8810m168x16.ts') },
	olivettithin8x16: { width: 8, height: 16, load: () => import('../generated/olivettithin8x16.ts') },
	spleen5x8: { width: 5, height: 8, load: () => import('../generated/spleen5x8.ts') },
	spleen6x12: { width: 6, height: 12, load: () => import('../generated/spleen6x12.ts') },
	ibmvga8x16: { width: 8, height: 16, load: () => import('../generated/ibmvga8x16.ts') },
	spleen8x16: { width: 8, height: 16, load: () => import('../generated/spleen8x16.ts') },
	templeos8x8: { width: 8, height: 8, load: () => import('../generated/templeos8x8.ts') },
	terminus8x16: { width: 8, height: 16, load: () => import('../generated/terminus8x16.ts') },
	terminus8x16bold: { width: 8, height: 16, load: () => import('../generated/terminus8x16bold.ts') },
	terminus10x18: { width: 10, height: 18, load: () => import('../generated/terminus10x18.ts') },
	terminus10x18bold: { width: 10, height: 18, load: () => import('../generated/terminus10x18bold.ts') },
	kana12x13: { width: 12, height: 13, load: () => import('../generated/kana12x13.ts') },
	spleen12x24: { width: 12, height: 24, load: () => import('../generated/spleen12x24.ts') },
	terminus12x24: { width: 12, height: 24, load: () => import('../generated/terminus12x24.ts') },
	terminus12x24bold: { width: 12, height: 24, load: () => import('../generated/terminus12x24bold.ts') },
	spleen16x32: { width: 16, height: 32, load: () => import('../generated/spleen16x32.ts') },
} as const;

export type Font = keyof typeof FONTS;
export const FONT_NAMES = Object.keys(FONTS) as readonly Font[];
export const DEFAULT_FONT: Font = 'ibmvga8x16';
