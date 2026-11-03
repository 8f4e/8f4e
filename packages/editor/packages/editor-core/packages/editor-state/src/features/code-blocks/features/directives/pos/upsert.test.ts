import { describe, expect, it } from 'vitest';
import upsertPos from './upsert';

describe('upsertPos', () => {
	it('adds @pos directive to code without existing @pos', () => {
		const code = ['module test', 'moduleEnd'];
		const result = upsertPos(code, 10, 20);
		expect(result).toEqual(['module test', '; @pos 10 20', 'moduleEnd']);
	});

	it('replaces existing @pos directive with new coordinates', () => {
		const code = ['module test', '; @pos 5 5', 'moduleEnd'];
		const result = upsertPos(code, 10, 20);
		expect(result).toEqual(['module test', '; @pos 10 20', 'moduleEnd']);
	});

	it('removes multiple @pos directives and adds one canonical', () => {
		const code = ['module test', '; @pos 5 5', '; @pos 10 10', 'moduleEnd'];
		const result = upsertPos(code, 15, 25);
		expect(result).toEqual(['module test', '; @pos 15 25', 'moduleEnd']);
	});

	it('preserves other directives while upserting @pos', () => {
		const code = ['module test', '; @group myGroup', '; @testDirective', 'moduleEnd'];
		const result = upsertPos(code, 10, 20);
		expect(result).toEqual(['module test', '; @pos 10 20', '; @group myGroup', '; @testDirective', 'moduleEnd']);
	});

	it('handles negative coordinates', () => {
		const code = ['module test', 'moduleEnd'];
		const result = upsertPos(code, -5, -10);
		expect(result).toEqual(['module test', '; @pos -5 -10', 'moduleEnd']);
	});

	it('handles zero coordinates', () => {
		const code = ['module test', 'moduleEnd'];
		const result = upsertPos(code, 0, 0);
		expect(result).toEqual(['module test', '; @pos 0 0', 'moduleEnd']);
	});

	it('is idempotent - same coordinates produce same result', () => {
		const code = ['module test', 'moduleEnd'];
		const result1 = upsertPos(code, 10, 20);
		const result2 = upsertPos(result1, 10, 20);
		expect(result1).toEqual(result2);
	});

	it('replaces @pos at different position with canonical position', () => {
		const code = ['module test', 'output out 1', '; @pos 5 5', 'moduleEnd'];
		const result = upsertPos(code, 10, 20);
		expect(result).toEqual(['module test', '; @pos 10 20', 'output out 1', 'moduleEnd']);
	});

	it('handles empty code array', () => {
		const code: string[] = [];
		const result = upsertPos(code, 10, 20);
		expect(result).toEqual(['; @pos 10 20']);
	});

	it('handles single-line code', () => {
		const code = ['module test'];
		const result = upsertPos(code, 10, 20);
		expect(result).toEqual(['module test', '; @pos 10 20']);
	});

	it('preserves exact order of other directives', () => {
		const code = ['module test', '; @group myGroup', '; @testDirective', '; @pos 1 1', 'output out 1', 'moduleEnd'];
		const result = upsertPos(code, 10, 20);
		expect(result).toEqual([
			'module test',
			'; @pos 10 20',
			'; @group myGroup',
			'; @testDirective',
			'output out 1',
			'moduleEnd',
		]);
	});
});
