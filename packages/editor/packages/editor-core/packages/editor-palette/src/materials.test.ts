import { describe, expect, it } from 'vitest';
import { type PaletteConfig, resolvePalette } from './index';

// Preserve established material choices across light, dark, saturated, and translucent themes.
const cases = [
	{
		name: 'default',
		config: {},
		expected: {
			surfaceRaised2: '#222222',
			inkSoft: '#a1a1a1',
			lightBase: '#cccccc',
			darkBase: '#000000',
			floatingSurface: '#161616',
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
			surfaceRaised2: '#1b1222',
			inkSoft: '#a596b2',
			lightBase: '#cccccc',
			darkBase: '#000000',
			floatingSurface: '#110a16',
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
			surfaceRaised2: '#e3e6f4',
			inkSoft: '#7d869c',
			lightBase: '#f6f5fa',
			darkBase: '#35405c',
			floatingSurface: '#e3e6f4',
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
			surfaceRaised2: '#e2ebfd',
			inkSoft: '#a6a6a6',
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
			inkSoft: '#e7ccb9',
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
			surfaceRaised2: '#88c2e1',
			inkSoft: 'rgba(245,245,245,0.3)',
			lightBase: '#cccccc',
			darkBase: '#000000',
			floatingSurface: '#7fbedf',
			selectionSurface: '#ffffff',
			inverseSurface: '#d4d4d4',
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
			surfaceRaised2: '#e8d6db',
			inkSoft: '#ae8c97',
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
