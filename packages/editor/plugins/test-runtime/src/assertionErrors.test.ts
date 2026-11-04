import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import assertionErrors from './assertionErrors';

describe('assertion errors', () => {
	it('reports the first failed invocation per source site and excludes included/unowned sites and disabled blocks', () => {
		const state = createMockState();
		const site = {
			siteId: 0,
			instruction: 'assert' as const,
			projectBlockId: 7,
			projectGroupPath: 'nested',
			codeBlockType: 'module' as const,
			codeBlockId: 'checks',
			lineNumber: 2,
		};
		const failure = { site, passed: false, message: 'First failure' };
		state.codeBlockRendering.rootProject.blocks = [
			createMockCodeBlock({ creationIndex: 7 }),
			createMockCodeBlock({ creationIndex: 8, disabled: true }),
		];
		state.assertionResults = [
			{ ...failure, passed: true },
			failure,
			{ ...failure, message: 'Repeated invocation' },
			{
				...failure,
				site: { ...site, siteId: 1, source: { kind: 'include', includeId: 'std/checks', symbolName: 'check' } },
			},
			{ ...failure, site: { ...site, siteId: 2, projectBlockId: 8 } },
			{ ...failure, site: { ...site, siteId: 3, projectBlockId: undefined } },
		];
		expect(assertionErrors(state)).toEqual([
			{ codeBlockId: 7, codeBlockType: 'module', lineNumber: 2, message: 'First failure' },
		]);
	});
});
