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
		const code = ['module test', '; @testDirective  ', '', 'moduleEnd'];
		const result = removeDirective(code, 'testDirective');
		expect(result).toEqual(['module test', '', 'moduleEnd']);
	});

	it('should handle indented directive', () => {
		const code = ['module test', '  ; @testDirective', '', 'moduleEnd'];
		const result = removeDirective(code, 'testDirective');
		expect(result).toEqual(['module test', '', 'moduleEnd']);
	});

	it('should handle directive with extra whitespace', () => {
		const code = ['module test', ';   @custom   myGroup', '', 'moduleEnd'];
		const result = removeDirective(code, 'custom');
		expect(result).toEqual(['module test', '', 'moduleEnd']);
	});

	it('should not remove other directives', () => {
		const code = ['module test', '; @custom myGroup', '; @testDirective', '', 'moduleEnd'];
		const result = removeDirective(code, 'custom');
		expect(result).toEqual(['module test', '; @testDirective', '', 'moduleEnd']);
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
		const code = ['module test', '; @testDirective', '; @custom test', '', 'moduleEnd'];
		const resultCustom = removeDirective(code, 'custom');
		expect(resultCustom).toEqual(['module test', '; @testDirective', '', 'moduleEnd']);

		const resultTestDirective = removeDirective(code, 'testDirective');
		expect(resultTestDirective).toEqual(['module test', '; @custom test', '', 'moduleEnd']);
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
		const code = ['module test', '; @custom myGroup @testDirective', 'moduleEnd'];
		const result = removeDirective(code, 'custom');
		expect(result).toEqual(['module test', '; @testDirective', 'moduleEnd']);
	});

	it('removes a trailing directive without removing the instruction', () => {
		expect(removeDirective(['  int gate 0 ; @testDirective'], 'testDirective')).toEqual(['  int gate 0']);
	});

	it('preserves neighboring trailing directives and the instruction', () => {
		expect(removeDirective(['int gate 0 ; @testDirective @watch'], 'testDirective')).toEqual(['int gate 0 ; @watch']);
	});
});
