import { describe, expect, it } from 'vitest';

import { updateDirectiveArgs, upsertDirective } from './index';

describe('directiveEditing with chained directives', () => {
	it('updateDirectiveArgs only rewrites the targeted directive on the line', () => {
		const code = ['module test', '; @custom audio @favorite', 'moduleEnd'];

		expect(updateDirectiveArgs(code, 'custom', ([name]) => [name, 'mode'])).toEqual([
			'module test',
			'; @custom audio mode @favorite',
			'moduleEnd',
		]);
	});

	it('upsertDirective removes prior chained instances before inserting the canonical line', () => {
		const code = ['module test', '; @favorite @pos 1 2', 'moduleEnd'];

		expect(upsertDirective(code, 'pos', ['3', '4'])).toEqual(['module test', '; @pos 3 4', '; @favorite', 'moduleEnd']);
	});
});
