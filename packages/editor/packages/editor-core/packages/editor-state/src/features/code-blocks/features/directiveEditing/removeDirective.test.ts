import { describe, expect, it } from 'vitest';

import { removeDirective } from './removeDirective';

describe('removeDirective', () => {
	it('should remove directive when present', () => {
		const code = ['module test', '; @custom myGroup', '', 'moduleEnd'];
		const result = removeDirective(code, 'custom');
		expect(result).toEqual(['module test', '', 'moduleEnd']);
	});

	it('should remove all occurrences of directive', () => {
		const code = ['module test', '; @custom first', '', '; @custom second', 'moduleEnd'];
		const result = removeDirective(code, 'custom');
		expect(result).toEqual(['module test', '', 'moduleEnd']);
	});

	it('should handle directive with trailing whitespace', () => {
		const code = ['module test', '; @favorite  ', '', 'moduleEnd'];
		const result = removeDirective(code, 'favorite');
		expect(result).toEqual(['module test', '', 'moduleEnd']);
	});

	it('should handle indented directive', () => {
		const code = ['module test', '  ; @favorite', '', 'moduleEnd'];
		const result = removeDirective(code, 'favorite');
		expect(result).toEqual(['module test', '', 'moduleEnd']);
	});

	it('should handle directive with extra whitespace', () => {
		const code = ['module test', ';   @custom   myGroup', '', 'moduleEnd'];
		const result = removeDirective(code, 'custom');
		expect(result).toEqual(['module test', '', 'moduleEnd']);
	});

	it('should not remove other directives', () => {
		const code = ['module test', '; @custom myGroup', '; @favorite', '', 'moduleEnd'];
		const result = removeDirective(code, 'custom');
		expect(result).toEqual(['module test', '; @favorite', '', 'moduleEnd']);
	});

	it('should be no-op when directive is not present', () => {
		const code = ['module test', '', 'moduleEnd'];
		const result = removeDirective(code, 'custom');
		expect(result).toEqual(['module test', '', 'moduleEnd']);
	});

	it('should handle directive with additional text', () => {
		const code = ['module test', '; @custom myGroup extra text', '', 'moduleEnd'];
		const result = removeDirective(code, 'custom');
		expect(result).toEqual(['module test', '', 'moduleEnd']);
	});

	it('should handle different directive names', () => {
		const code = ['module test', '; @favorite', '; @custom test', '', 'moduleEnd'];
		const resultCustom = removeDirective(code, 'custom');
		expect(resultCustom).toEqual(['module test', '; @favorite', '', 'moduleEnd']);

		const resultFavorite = removeDirective(code, 'favorite');
		expect(resultFavorite).toEqual(['module test', '; @custom test', '', 'moduleEnd']);
	});

	it('should handle empty code array', () => {
		const code: string[] = [];
		const result = removeDirective(code, 'custom');
		expect(result).toEqual([]);
	});

	it('should not mutate original array', () => {
		const code = ['module test', '; @custom myGroup', '', 'moduleEnd'];
		const original = [...code];
		removeDirective(code, 'custom');
		expect(code).toEqual(original);
	});

	it('should preserve other directives on the same line', () => {
		const code = ['module test', '; @custom myGroup @favorite', 'moduleEnd'];
		const result = removeDirective(code, 'custom');
		expect(result).toEqual(['module test', '; @favorite', 'moduleEnd']);
	});

	it('removes a trailing directive without removing the instruction', () => {
		expect(removeDirective(['  int gate 0 ; @favorite'], 'favorite')).toEqual(['  int gate 0']);
	});

	it('preserves neighboring trailing directives and the instruction', () => {
		expect(removeDirective(['int gate 0 ; @favorite @watch'], 'favorite')).toEqual(['int gate 0 ; @watch']);
	});
});
