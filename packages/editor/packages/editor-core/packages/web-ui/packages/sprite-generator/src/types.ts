import type { PaletteConfig } from '@8f4e/editor-palette';
import type { SpriteCoordinates } from 'glugglugglug';

export const FONT_NAMES = [
	'attpc63008x16',
	'6x10',
	'nix8810m168x16',
	'olivettithin8x16',
	'spleen5x8',
	'spleen6x12',
	'ibmvga8x16',
	'spleen8x16',
	'templeos8x8',
	'terminus8x16',
	'terminus8x16bold',
	'terminus10x18',
	'terminus10x18bold',
	'kana12x13',
	'spleen12x24',
	'terminus12x24',
	'terminus12x24bold',
	'spleen16x32',
] as const;

export type Font = (typeof FONT_NAMES)[number];

export interface Config {
	palette?: PaletteConfig;
	font?: string;
}

export type SpriteLookup<T extends string = string> = Record<T, SpriteCoordinates>;
