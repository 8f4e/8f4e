import { compileProject } from '@8f4e/compiler';
import { serializeToProject } from '@8f4e/editor-state';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { AssertionResult } from '@8f4e/editor-state-types';
import type { AssertionSite } from '@8f4e/language-spec';
import { runTests } from '@8f4e/test-runner';
import { describe, expect, it } from 'vitest';
import deriveAssertionMarkers from './deriveAssertionMarkers';

const code = ['module checks', 'push 1', 'assert', 'push 2', 'assertEqual 2', 'moduleEnd'];

function site(overrides: Partial<AssertionSite> = {}): AssertionSite {
	return {
		siteId: 0,
		instruction: 'assert',
		projectBlockId: 7,
		projectGroupPath: 'audio',
		codeBlockType: 'module',
		codeBlockId: 'checks',
		lineNumber: 2,
		...overrides,
	};
}

function invocation(site: AssertionSite, passed = true): AssertionResult {
	return { site, passed };
}

function setup() {
	const block = createMockCodeBlock({
		code,
		blockType: 'module',
		creationIndex: 7,
		projectPath: 'audio',
		lineNumberColumnWidth: 2,
	});
	const state = createMockState({ viewport: { vGrid: 8, hGrid: 16 } });
	return { block, state };
}

describe('assertion marker derivation', () => {
	it('maps executed compiler sites back to editor blocks and omits unexecuted assertions', async () => {
		const { block, state } = setup();
		block.code = [
			'module checks',
			'push 1',
			'assert',
			'push 0',
			'if',
			'push 0',
			'assert',
			'ifEnd',
			'push 2',
			'assertEqual 2',
			'moduleEnd',
		];
		block.displayModel = createMockCodeBlock({ code: block.code }).displayModel;
		block.entry = 'test';
		block.projectPath = '';
		const compiled = await compileProject(
			serializeToProject(
				createMockState({ codeBlockRendering: { rootProject: { entries: [], path: '', blocks: [block] } } })
			),
			{
				enableAssertions: true,
				disableSharedMemory: true,
			}
		);
		const result = await runTests(compiled);
		state.assertionResults = result.assertions;
		expect(deriveAssertionMarkers(block, state)).toEqual([
			{ passed: true, x: 8, y: 32, width: 16, height: 16 },
			{ passed: true, x: 8, y: 144, width: 16, height: 16 },
		]);
	});
	it('aggregates repeated calls with failure taking precedence', () => {
		const { block, state } = setup();
		const failedSite = site();
		const passedSite = site({ siteId: 1, instruction: 'assertEqual', lineNumber: 4 });
		state.assertionResults = [
			invocation(failedSite, true),
			invocation(failedSite, false),
			invocation(failedSite, true),
			invocation(passedSite, true),
			invocation(passedSite, true),
		];
		expect(deriveAssertionMarkers(block, state)).toEqual([
			{ passed: false, x: 8, y: 32, width: 16, height: 16 },
			{ passed: true, x: 8, y: 64, width: 16, height: 16 },
		]);
	});

	it('matches physical block identity and project path, including functions', () => {
		const { block, state } = setup();
		state.assertionResults = [
			invocation(site()),
			invocation(site({ siteId: 1, projectBlockId: 8 })),
			invocation(site({ siteId: 2, projectGroupPath: 'other' })),
			invocation(site({ siteId: 3, codeBlockType: 'function' })),
			invocation(site({ siteId: 4, projectBlockId: undefined })),
			invocation(site({ siteId: 5, source: { kind: 'include', includeId: 'test/helpers', symbolName: 'checks' } })),
		];
		expect(deriveAssertionMarkers(block, state)).toHaveLength(1);
		block.blockType = 'function';
		expect(deriveAssertionMarkers(block, state)).toHaveLength(1);
	});

	it('uses displayed rows and widget gaps, omitting assertions hidden by collapse', () => {
		const { block, state } = setup();
		state.assertionResults = [invocation(site()), invocation(site({ siteId: 1, lineNumber: 4 }))];
		block.displayModel.sourceLineIndexToDisplayRow[4] = undefined;
		block.gaps.set(1, { size: 3 });
		expect(deriveAssertionMarkers(block, state)).toEqual([{ passed: true, x: 8, y: 80, width: 16, height: 16 }]);
		block.displayModel = createMockCodeBlock({ code }).displayModel;
		expect(deriveAssertionMarkers(block, state)).toHaveLength(2);
	});

	it('returns no markers without results, for disabled blocks, or during recompilation', () => {
		const { block, state } = setup();
		expect(deriveAssertionMarkers(block, state)).toEqual([]);
		state.assertionResults = [invocation(site())];
		block.disabled = true;
		expect(deriveAssertionMarkers(block, state)).toEqual([]);
		block.disabled = false;
		state.compiler.isCompiling = true;
		expect(deriveAssertionMarkers(block, state)).toEqual([]);
	});
});
