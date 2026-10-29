import { describe, expect, it } from 'vitest';
import { updateDirectiveArgs } from './updateDirectiveArgs';
import { upsertDirective } from './upsertDirective';

describe('editing trailing directives', () => {
	it('updates arguments while preserving the instruction and neighboring directives', () => {
		const code = ['  int gate 0  ; @group audio @watch', '; @group audio'];
		expect(updateDirectiveArgs(code, 'group', ([name]) => [name, 'nonstick'])).toEqual([
			'  int gate 0  ; @group audio nonstick @watch',
			'; @group audio nonstick',
		]);
	});

	it('upserts one canonical directive while preserving instructions containing previous occurrences', () => {
		const code = ['module test', 'int gate 0 ; @pos 1 2 @watch', '; @pos 3 4', 'moduleEnd'];
		expect(upsertDirective(code, 'pos', ['5', '6'])).toEqual([
			'module test',
			'; @pos 5 6',
			'int gate 0 ; @watch',
			'moduleEnd',
		]);
	});
});
