import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { expect, it } from 'vitest';
import { setup } from '../__tests__/setup';
import { createScopeDirectiveReader } from '../helpers/data';
import type { Scope } from '../types';
import { registerScopePreparation } from './layout';

it('retains no scope layout data for blocks without scopes, including after removing the last directive', async () => {
	const source = ['module audio', 'float level 0', 'moduleEnd'];
	const test = await setup(source, { installed: false });
	const scopesByBlock = new WeakMap<CodeBlockGraphicData, Scope[]>();
	const preparation = registerScopePreparation(test.store.layout, scopesByBlock, createScopeDirectiveReader());

	try {
		expect(scopesByBlock.has(test.block)).toBe(false);
		expect(test.block.gaps.size).toBe(0);

		test.update(['module audio', 'float level 0', '; @scope level 30', 'moduleEnd']);
		test.acceptCompilation();
		preparation.refresh(test.state);
		expect(scopesByBlock.get(test.block)).toHaveLength(1);
		expect(test.block.gaps.get(2)?.size).toBe(8);

		test.update(source);
		expect(scopesByBlock.has(test.block)).toBe(false);
		expect(test.block.gaps.size).toBe(0);
	} finally {
		preparation.dispose();
	}
});
