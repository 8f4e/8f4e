import { describe, expect, it } from 'vitest';
import upsertDisabled from './upsert';

describe('upsertDisabled', () => {
	it('adds @disabled directive when disabled is true', () => {
		const code = ['module test', 'moduleEnd'];
		const result = upsertDisabled(code, true);
		expect(result).toEqual(['module test', '; @disabled', 'moduleEnd']);
	});

	it('removes @disabled directive when disabled is false', () => {
		const code = ['module test', '; @disabled', 'moduleEnd'];
		const result = upsertDisabled(code, false);
		expect(result).toEqual(['module test', 'moduleEnd']);
	});

	it('is idempotent when disabled is true', () => {
		const code = ['module test', 'moduleEnd'];
		const result1 = upsertDisabled(code, true);
		const result2 = upsertDisabled(result1, true);
		expect(result1).toEqual(result2);
		expect(result1).toEqual(['module test', '; @disabled', 'moduleEnd']);
	});

	it('is idempotent when disabled is false', () => {
		const code = ['module test', 'moduleEnd'];
		const result1 = upsertDisabled(code, false);
		const result2 = upsertDisabled(result1, false);
		expect(result1).toEqual(result2);
		expect(result1).toEqual(['module test', 'moduleEnd']);
	});

	it('removes multiple @disabled directives when disabled is false', () => {
		const code = ['module test', '; @disabled', '; @disabled', 'moduleEnd'];
		const result = upsertDisabled(code, false);
		expect(result).toEqual(['module test', 'moduleEnd']);
	});

	it('removes multiple @disabled directives and adds one when disabled is true', () => {
		const code = ['module test', '; @disabled', '; @disabled', 'moduleEnd'];
		const result = upsertDisabled(code, true);
		expect(result).toEqual(['module test', '; @disabled', 'moduleEnd']);
	});

	it('preserves other directives when adding @disabled', () => {
		const code = ['module test', '; @group myGroup', '; @pos 10 20', '; @marker', 'moduleEnd'];
		const result = upsertDisabled(code, true);
		expect(result).toEqual([
			'module test',
			'; @disabled',
			'; @group myGroup',
			'; @pos 10 20',
			'; @marker',
			'moduleEnd',
		]);
	});

	it('preserves other directives when removing @disabled', () => {
		const code = ['module test', '; @disabled', '; @group myGroup', '; @pos 10 20', 'moduleEnd'];
		const result = upsertDisabled(code, false);
		expect(result).toEqual(['module test', '; @group myGroup', '; @pos 10 20', 'moduleEnd']);
	});

	it('handles empty code array when disabled is true', () => {
		const code: string[] = [];
		const result = upsertDisabled(code, true);
		expect(result).toEqual(['; @disabled']);
	});

	it('handles empty code array when disabled is false', () => {
		const code: string[] = [];
		const result = upsertDisabled(code, false);
		expect(result).toEqual([]);
	});

	it('handles single-line code when disabled is true', () => {
		const code = ['module test'];
		const result = upsertDisabled(code, true);
		expect(result).toEqual(['module test', '; @disabled']);
	});

	it('handles single-line code when disabled is false', () => {
		const code = ['module test'];
		const result = upsertDisabled(code, false);
		expect(result).toEqual(['module test']);
	});

	it('replaces @disabled at different position with canonical position when disabled is true', () => {
		const code = ['module test', 'output out 1', '; @disabled', 'moduleEnd'];
		const result = upsertDisabled(code, true);
		expect(result).toEqual(['module test', '; @disabled', 'output out 1', 'moduleEnd']);
	});

	it('handles plain comments that mention disabled but are not directives', () => {
		const code = ['module test', '; this is disabled by default', 'moduleEnd'];
		const result = upsertDisabled(code, true);
		expect(result).toEqual(['module test', '; @disabled', '; this is disabled by default', 'moduleEnd']);
	});

	it('preserves exact order of other directives when adding @disabled', () => {
		const code = ['module test', '; @group myGroup', '; @marker', '; @pos 10 20', 'output out 1', 'moduleEnd'];
		const result = upsertDisabled(code, true);
		expect(result).toEqual([
			'module test',
			'; @disabled',
			'; @group myGroup',
			'; @marker',
			'; @pos 10 20',
			'output out 1',
			'moduleEnd',
		]);
	});
});
