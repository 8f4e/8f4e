import { describe, expect, it } from 'vitest';
import { type PaletteConfig, resolvePalette } from './index';

// Preserve established material choices across light, dark, saturated, and translucent themes.
const cases = [
	{
		name: 'default',
		config: {},
		expected: {
			surfaceRaised2: '#0f0f0f',
			lightBase: '#cccccc',
			darkBase: '#000000',
			floatingSurface: '#080808',
			selectionSurface: '#ffffff',
			inverseSurface: '#d4d4d4',
		},
	},
	{
		name: 'custom primary defaults',
		config: {
			primary: '#d9a6ff',
		},
		expected: {
			surfaceRaised2: '#100d13',
			lightBase: '#cccccc',
			darkBase: '#000000',
			floatingSurface: '#09070b',
			selectionSurface: '#d9a6ff',
			inverseSurface: '#cec7d4',
		},
	},
	{
		name: 'subdued light',
		config: {
			surface: '#f6f5fa',
			ink: '#35405c',
			muted: '#8b93a8',
			primary: '#4c60b4',
			warning: '#d6a748',
		},
		expected: {
			surfaceRaised2: '#ebebf2',
			lightBase: '#f6f5fa',
			darkBase: '#35405c',
			floatingSurface: '#ebebf2',
			selectionSurface: '#4c60b4',
			inverseSurface: '#2d364f',
		},
	},
	{
		name: 'dark muted on light',
		config: {
			surface: '#fff',
			ink: '#000',
			muted: '#555',
			primary: '#00c',
		},
		expected: {
			surfaceRaised2: '#ededed',
			lightBase: '#ffffff',
			darkBase: '#000000',
			floatingSurface: '#001e9f',
			selectionSurface: '#ffffff',
			inverseSurface: '#000000',
		},
	},
	{
		name: 'saturated dark',
		config: {
			canvas: '#609',
			surface: '#700090',
			ink: '#fff',
			primary: '#ffcc00',
		},
		expected: {
			surfaceRaised2: '#4a0060',
			lightBase: '#ffffff',
			darkBase: '#000000',
			floatingSurface: '#700090',
			selectionSurface: '#ffcc00',
			inverseSurface: '#fff8e5',
		},
	},
	{
		name: 'translucent',
		config: {
			canvas: '#3399cc',
			surface: 'rgba(255,255,255,0.2)',
			ink: '#ccc',
			primary: '#fff',
			muted: 'rgba(255,255,255,0.3)',
		},
		expected: {
			surfaceRaised2: 'rgba(255,255,255,0.15)',
			lightBase: '#ffffff',
			darkBase: '#003952',
			floatingSurface: 'rgba(255,255,255,0.8)',
			selectionSurface: '#006791',
			inverseSurface: 'rgba(0,57,82,0.95)',
		},
	},
	{
		name: 'translucent primary',
		config: {
			canvas: '#fff',
			surface: 'rgba(0,0,0,0.1)',
			ink: '#000',
			primary: 'rgba(220,50,130,0.2)',
		},
		expected: {
			surfaceRaised2: '#dad3d5',
			lightBase: '#e6e6e6',
			darkBase: '#000000',
			floatingSurface: '#c61370',
			selectionSurface: '#e6e6e6',
			inverseSurface: '#000000',
		},
	},
] satisfies { name: string; config: PaletteConfig; expected: Record<string, string> }[];

describe('palette material rules', () => {
	it.each(cases)('preserves the colors of $name', ({ config, expected }) => {
		expect(resolvePalette(config).colors).toMatchObject(expected);
	});
});
