import { createMockCodeBlock, createMockEventDispatcher, createMockState } from '@8f4e/editor-state-testing';
import type { AssertionResult } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it } from 'vitest';
import codeBlockRendering from './effect';
import { directiveDefinitions } from './features/directives/registry';
import { createLayoutRegistry } from './layout/registry';

function setup() {
	const block = createMockCodeBlock({
		code: ['module checks', 'push 1', 'assert', 'moduleEnd'],
		blockType: 'module',
		creationIndex: 7,
	});
	const state = createMockState();
	state.codeBlockRendering.codeBlocks = [block];
	state.codeBlockRendering.rootCodeBlocks = [block];
	const store = createStateManager(state);
	const result: AssertionResult[] = [
		{
			site: {
				siteId: 0,
				instruction: 'assert',
				projectBlockId: 7,
				projectGroupPath: '',
				codeBlockType: 'module',
				codeBlockId: 'checks',
				lineNumber: 2,
			},
			passed: true,
		},
	];
	return { state, block, store, result };
}

describe('assertion error messages', () => {
	it('shows failure values inline once per site and clears messages and gaps on restart', () => {
		const { store, state, block, result } = setup();
		block.code = ['module checks', 'push 10', 'assertEqual 9', 'push 0', 'assert', 'moduleEnd'];
		codeBlockRendering(
			store,
			createMockEventDispatcher(),
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);
		const failure = {
			...result[0],
			site: { ...result[0].site, instruction: 'assertEqual' as const },
			passed: false,
			message: 'Assertion failed: expected 9, received 10',
		};
		const conditionFailure = {
			...result[0],
			site: { ...result[0].site, siteId: 1, lineNumber: 4 },
			passed: false,
			message: 'Assertion failed: expected nonzero, received 0',
		};
		store.set('assertionResults', [failure, { ...failure, passed: true }, failure, conditionFailure]);
		expect(block.widgets.errorMessages).toHaveLength(2);
		expect(block.widgets.errorMessages[0].message.join(' ').replace(/\s+/g, ' ')).toContain('expected 9, received 10');
		expect(block.widgets.errorMessages[1].message.join(' ').replace(/\s+/g, ' ')).toContain(
			'expected nonzero, received 0'
		);
		expect(block.widgets.errorMessages[0].y).toBe(3 * state.viewport.hGrid);
		expect(block.widgets.errorMessages[1].y).toBe(
			(5 + block.widgets.errorMessages[0].message.length) * state.viewport.hGrid
		);
		expect(block.height).toBeGreaterThan(block.code.length * state.viewport.hGrid);
		store.set('compiler.isCompiling', true);
		expect(block.widgets.errorMessages).toEqual([]);
		expect(block.gaps.size).toBe(0);
		expect(block.height).toBe(block.code.length * state.viewport.hGrid);
		store.set('assertionResults', []);
		store.set('compiler.isCompiling', false);
		expect(block.widgets.errorMessages).toEqual([]);
		store.set('assertionResults', [failure]);
		store.set('assertionResults', []);
		expect(block.widgets.errorMessages).toEqual([]);
		expect(block.gaps.size).toBe(0);
	});

	it('shows failures in their owning project slice and omits disabled and included-source assertions', () => {
		const { store, state, block, result } = setup();
		block.projectPath = 'nested';
		state.codeBlockRendering.codeBlocks = [];
		codeBlockRendering(
			store,
			createMockEventDispatcher(),
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);
		const failure = {
			...result[0],
			site: { ...result[0].site, projectGroupPath: 'nested' },
			passed: false,
			message: 'Assertion failed: expected nonzero, received 0',
		};
		store.set('assertionResults', [
			failure,
			{ ...failure, site: { ...failure.site, siteId: 1, projectGroupPath: 'other' } },
			{
				...failure,
				site: { ...failure.site, siteId: 2, source: { kind: 'include', includeId: 'std/check', symbolName: 'check' } },
			},
		]);
		expect(block.widgets.errorMessages).toEqual([]);
		store.set('codeBlockRendering.codeBlocks', [block]);
		expect(block.widgets.errorMessages).toHaveLength(1);
		block.code.splice(1, 0, '; @disabled');
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block);
		expect(block.disabled).toBe(true);
		expect(block.widgets.errorMessages).toEqual([]);
	});
});
