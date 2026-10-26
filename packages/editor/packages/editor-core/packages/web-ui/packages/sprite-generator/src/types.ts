import type { PaletteConfig } from '@8f4e/editor-palette';
import type { SpriteCoordinates } from 'glugglugglug';

export const Command = {
	FILL_COLOR: 0,
	RECTANGLE: 1,
	TRANSLATE: 2,
	SAVE: 3,
	RESTORE: 4,
	RESET_TRANSFORM: 5,
	PIXEL: 6,
} as const;

export type CommandValue = (typeof Command)[keyof typeof Command];

export type DrawingCommand =
	| [command: typeof Command.FILL_COLOR, fillColor: string]
	| [command: typeof Command.RECTANGLE, x: number, y: number, width: number, height: number]
	| [command: typeof Command.TRANSLATE, x: number, y: number]
	| [command: typeof Command.PIXEL, x: number, y: number]
	| [command: typeof Command.SAVE]
	| [command: typeof Command.RESTORE]
	| [command: typeof Command.RESET_TRANSFORM];

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
