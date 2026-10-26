import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { CompiledStackAnalysisLine, Stack } from '@8f4e/language-spec';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	createMockCodeBlock,
	createMockState,
	deriveDirectiveStateForMockCodeBlock,
} from '~/pureHelpers/testingUtils/testUtils';
import { runBeforeGraphicDataWidthCalculation, runBlockLayoutReady } from '../registry';

function createStackAnalysisLine(lineNumber: number, stackAfter: Stack): CompiledStackAnalysisLine {
	return {
		lineNumber,
		instruction: 'test',
		stackAnalysis: {
			stackBefore: [],
			stackAfter,
			consumedOperands: [],
			producedStackItems: [],
		},
	};
}

describe('stack directive widget resolution', () => {
	let graphicData: CodeBlockGraphicData;
	let state: State;

	beforeEach(() => {
		graphicData = createMockCodeBlock({
			name: 'test-block',
			code: ['module test-block', 'push 2', 'push 3', '; @stack', 'moduleEnd'],
			blockType: 'module',
			lineNumberColumnWidth: 1,
			gaps: new Map(),
		});
		state = createMockState({
			codeBlockRendering: {
				viewport: { vGrid: 10, hGrid: 20 },
			},
			compiler: {
				compiledModules: {
					'test-block': {
						stackAnalysis: [
							createStackAnalysisLine(2, [
								{ kind: 'value', valueType: 'int', knownValue: 2 },
								{ kind: 'value', valueType: 'int', knownValue: 3 },
							]),
						],
					},
				},
			},
		});
	});

	function runDirectiveResolution(): void {
		const directiveState = deriveDirectiveStateForMockCodeBlock(graphicData);
		runBeforeGraphicDataWidthCalculation(graphicData, state, directiveState);
		runBlockLayoutReady(graphicData, state, directiveState);
	}

	it('renders known values from the preceding instruction for a standalone directive', () => {
		runDirectiveResolution();

		expect(graphicData.widgets.debuggers).toContainEqual(expect.objectContaining({ id: 'stack:3', text: '2, 3' }));
	});

	it('uses the same source line for a trailing directive', () => {
		graphicData.code = ['module test-block', 'push 2 ; @stack', 'moduleEnd'];
		state.compiler.compiledModules['test-block']!.stackAnalysis = [
			createStackAnalysisLine(1, [{ kind: 'value', valueType: 'int', knownValue: 2 }]),
		];

		runDirectiveResolution();

		expect(graphicData.widgets.debuggers).toContainEqual(expect.objectContaining({ id: 'stack:1', text: '2' }));
	});

	it('supports @s as a shorthand alias', () => {
		graphicData.code = ['module test-block', 'push 2 ; @s', 'moduleEnd'];
		state.compiler.compiledModules['test-block']!.stackAnalysis = [
			createStackAnalysisLine(1, [{ kind: 'value', valueType: 'int', knownValue: 2 }]),
		];

		runDirectiveResolution();

		expect(graphicData.widgets.debuggers).toContainEqual(expect.objectContaining({ id: 'stack:1', text: '2' }));
	});

	it('shows types when stack values are not statically known', () => {
		state.compiler.compiledModules['test-block']!.stackAnalysis = [
			createStackAnalysisLine(2, [
				{ kind: 'value', valueType: 'int' },
				{ kind: 'value', valueType: 'int', knownValue: 3 },
			]),
		];

		runDirectiveResolution();

		expect(graphicData.widgets.debuggers).toContainEqual(expect.objectContaining({ id: 'stack:3', text: 'int, 3' }));
	});

	it('renders an empty stack', () => {
		state.compiler.compiledModules['test-block']!.stackAnalysis = [createStackAnalysisLine(2, [])];

		runDirectiveResolution();

		expect(graphicData.widgets.debuggers).toContainEqual(expect.objectContaining({ id: 'stack:3', text: '' }));
	});

	it('resolves stack analysis for function blocks', () => {
		graphicData = createMockCodeBlock({
			name: 'helper',
			code: ['function helper', 'push 3', '; @stack', 'functionEnd'],
			blockType: 'function',
			creationIndex: 42,
		});
		state.compiler.compiledFunctions = {
			helper: {
				ast: { projectBlockId: 42 },
				stackAnalysis: [createStackAnalysisLine(1, [{ kind: 'value', valueType: 'int', knownValue: 3 }])],
			},
		} as never;

		runDirectiveResolution();

		expect(graphicData.widgets.debuggers).toContainEqual(expect.objectContaining({ id: 'stack:2', text: '3' }));
	});

	it('does not render when no matching stack analysis is available', () => {
		state.compiler.compiledModules['test-block']!.stackAnalysis = [];

		runDirectiveResolution();

		expect(graphicData.widgets.debuggers).toEqual([]);
	});

	it('ignores unsupported arguments', () => {
		graphicData.code = ['module test-block', 'push 2', '; @stack extra', 'moduleEnd'];

		runDirectiveResolution();

		expect(graphicData.widgets.debuggers).toEqual([]);
	});
});
