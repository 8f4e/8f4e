import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import deriveFavorites from './deriveFavorites';

// Helper to create a minimal mock code block
function mockCodeBlock(
	creationIndex: number,
	name: string,
	blockType: string,
	isFavorite: boolean
): CodeBlockGraphicData {
	return {
		creationIndex,
		name,
		blockType,
		isFavorite,
		code: [],
		// Minimal required properties
		gridX: 0,
		gridY: 0,
		width: 100,
		height: 100,
		x: 0,
		y: 0,
		disabled: false,
		isHome: false,
		lastUpdated: 0,
		widgets: {
			blockHighlights: [],
			inputs: [],
			outputs: [],
			debuggers: [],
			arrayPlotters: [],
			arrayBars: [],
			arrayMeters: [],
			sliders: [],
			pianoKeyboards: [],
			errorMessages: [],
		},
	} as CodeBlockGraphicData;
}

describe('deriveFavorites', () => {
	it('should return empty array for no code blocks', () => {
		expect(deriveFavorites([])).toEqual([]);
	});

	it('should return empty array when no blocks have @favorite', () => {
		const blocks = [mockCodeBlock(0, 'module1', 'module', false), mockCodeBlock(1, 'func1', 'function', false)];
		expect(deriveFavorites(blocks)).toEqual([]);
	});

	it('should return single favorite', () => {
		const blocks = [mockCodeBlock(0, 'osc', 'module', true)];
		const result = deriveFavorites(blocks);
		expect(result).toEqual([{ creationIndex: 0, name: 'osc', blockType: 'module' }]);
	});

	it('should return multiple favorites', () => {
		const blocks = [
			mockCodeBlock(0, 'osc', 'module', true),
			mockCodeBlock(1, 'filter', 'module', false),
			mockCodeBlock(2, 'mix', 'function', true),
		];
		const result = deriveFavorites(blocks);
		expect(result).toEqual([
			{ creationIndex: 0, name: 'osc', blockType: 'module' },
			{ creationIndex: 2, name: 'mix', blockType: 'function' },
		]);
	});

	it('should sort favorites by creationIndex', () => {
		const blocks = [
			mockCodeBlock(5, 'c', 'module', true),
			mockCodeBlock(1, 'a', 'module', true),
			mockCodeBlock(3, 'b', 'function', true),
		];
		const result = deriveFavorites(blocks);
		expect(result).toEqual([
			{ creationIndex: 1, name: 'a', blockType: 'module' },
			{ creationIndex: 3, name: 'b', blockType: 'function' },
			{ creationIndex: 5, name: 'c', blockType: 'module' },
		]);
	});

	it('should deduplicate by creationIndex', () => {
		// This shouldn't happen in practice, but handles edge case
		const blocks = [mockCodeBlock(0, 'osc', 'module', true), mockCodeBlock(0, 'osc', 'module', true)];
		const result = deriveFavorites(blocks);
		expect(result).toEqual([{ creationIndex: 0, name: 'osc', blockType: 'module' }]);
	});

	it('should handle duplicate names with different creationIndices', () => {
		const blocks = [mockCodeBlock(0, 'osc', 'module', true), mockCodeBlock(1, 'osc', 'module', true)];
		const result = deriveFavorites(blocks);
		expect(result).toEqual([
			{ creationIndex: 0, name: 'osc', blockType: 'module' },
			{ creationIndex: 1, name: 'osc', blockType: 'module' },
		]);
	});

	it('should handle all block types', () => {
		const blocks = [
			mockCodeBlock(0, 'mod', 'module', true),
			mockCodeBlock(1, 'fn', 'function', true),
			mockCodeBlock(2, 'note', 'note', true),
			mockCodeBlock(4, 'consts', 'constants', true),
		];
		const result = deriveFavorites(blocks);
		expect(result).toEqual([
			{ creationIndex: 0, name: 'mod', blockType: 'module' },
			{ creationIndex: 1, name: 'fn', blockType: 'function' },
			{ creationIndex: 2, name: 'note', blockType: 'note' },
			{ creationIndex: 4, name: 'consts', blockType: 'constants' },
		]);
	});

	it('should not count non-favorite blocks', () => {
		const blocks = [
			mockCodeBlock(0, 'a', 'module', false),
			mockCodeBlock(1, 'b', 'module', true),
			mockCodeBlock(2, 'c', 'module', false),
		];
		const result = deriveFavorites(blocks);
		expect(result).toEqual([{ creationIndex: 1, name: 'b', blockType: 'module' }]);
	});
});
