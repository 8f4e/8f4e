import { resolvePalette } from '@8f4e/editor-palette';
import type { Config } from '../../src/types';

export const testPaletteConfig = { canvas: '#061420', surface: '#021924', ink: '#f8ffff', primary: '#5bd5ff' };
export const testPalette = resolvePalette(testPaletteConfig);

/**
 * Test fixture for attpc63008x16 font configuration
 */
export const configAttPc63008x16: Config = {
	font: 'attpc63008x16',
	palette: testPaletteConfig,
};

/**
 * Test fixture for nix8810m168x16 font configuration
 */
export const configNix8810M168x16: Config = {
	font: 'nix8810m168x16',
	palette: testPaletteConfig,
};

/**
 * Test fixture for olivettithin8x16 font configuration
 */
export const configOlivettiThin8x16: Config = {
	font: 'olivettithin8x16',
	palette: testPaletteConfig,
};

/**
 * Test fixture for ibmvga8x16 font configuration
 */
export const config8x16: Config = {
	font: 'ibmvga8x16',
	palette: testPaletteConfig,
};

/**
 * Test fixture for terminus8x16 font configuration
 */
export const configTerminus8x16: Config = {
	font: 'terminus8x16',
	palette: testPaletteConfig,
};

/**
 * Test fixture for terminus8x16bold font configuration
 */
export const configTerminus8x16Bold: Config = {
	font: 'terminus8x16bold',
	palette: testPaletteConfig,
};

/**
 * Test fixture for 6x10 font configuration
 */
export const config6x10: Config = {
	font: '6x10',
	palette: testPaletteConfig,
};

/**
 * Test fixture for terminus10x18 font configuration
 */
export const configTerminus10x18: Config = {
	font: 'terminus10x18',
	palette: testPaletteConfig,
};

/**
 * Test fixture for terminus10x18bold font configuration
 */
export const configTerminus10x18Bold: Config = {
	font: 'terminus10x18bold',
	palette: testPaletteConfig,
};

/**
 * Test fixture for kana12x13 font configuration
 */
export const configKana12x13: Config = {
	font: 'kana12x13',
	palette: testPaletteConfig,
};

/**
 * Test fixture for terminus12x24 font configuration
 */
export const configTerminus12x24: Config = {
	font: 'terminus12x24',
	palette: testPaletteConfig,
};

/**
 * Test fixture for terminus12x24bold font configuration
 */
export const configTerminus12x24Bold: Config = {
	font: 'terminus12x24bold',
	palette: testPaletteConfig,
};

/**
 * Standard character dimensions for 8x16 font
 */
export const characterDimensions8x16 = {
	width: 8,
	height: 16,
};

/**
 * Standard character dimensions for 6x10 font
 */
export const characterDimensions6x10 = {
	width: 6,
	height: 10,
};
