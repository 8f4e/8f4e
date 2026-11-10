import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { TestAssertionResult } from '@8f4e/test-runner';
import { describe, expect, it } from 'vitest';
import assertionErrors from './assertionErrors';

describe('assertion errors', () => {
	it('reports the first failed invocation per source site and excludes included/unowned sites and disabled blocks', () => {
		const state = createMockState();
		const site = {
			siteId: 0,
			instruction: 'assertEqual' as const,
			projectBlockId: 7,
			projectGroupPath: 'nested',
			codeBlockType: 'module' as const,
			codeBlockId: 'checks',
			lineNumber: 2,
		};
		const failure = { site, passed: false, expected: 9, received: 10, assertIndex: 0 };
		state.codeBlockRendering.rootProject.blocks = [
			createMockCodeBlock({ creationIndex: 7 }),
			createMockCodeBlock({ creationIndex: 8, disabled: true }),
		];
		const assertions: TestAssertionResult[] = [
			{ ...failure, passed: true, received: 9 },
			failure,
			{ ...failure, received: 11 },
			{
				...failure,
				site: { ...site, siteId: 1, source: { kind: 'include', includeId: 'std/checks', symbolName: 'check' } },
			},
			{ ...failure, site: { ...site, siteId: 2, projectBlockId: 8 } },
			{ ...failure, site: { ...site, siteId: 3, projectBlockId: undefined } },
		];
		expect(assertionErrors(assertions, state.codeBlockRendering.rootProject)).toEqual([
			{ codeBlockId: 7, lineNumber: 2, message: 'Assertion failed: expected 9, received 10' },
		]);
	});
});
