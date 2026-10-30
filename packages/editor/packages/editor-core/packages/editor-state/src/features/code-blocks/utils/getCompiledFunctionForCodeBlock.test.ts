import {
	type CompiledFunction,
	type ComposedFunctionAST,
	createFunctionId,
	ROOT_PROJECT_GROUP_PATH,
} from '@8f4e/language-spec';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '../../../pureHelpers/testingUtils/testUtils';
import tooltip from '../../tooltip/effect';
import { createStackDirectiveWidgetContribution } from '../features/directives/stack/resolve';
import gaps from '../gaps';
import paramShape, { updateParamShapeDeclarations } from '../paramShape/updateGraphicData';
import { createCodeBlockGraphicData } from './createCodeBlockGraphicData';
import { getCompiledFunctionForCodeBlock, getCompiledFunctionsByBlockId } from './getCompiledFunctionForCodeBlock';

function createTestCompiledFunction(
	name: string,
	projectBlockId: number,
	options: {
		paramLabel?: { type: 'int*' | 'float*'; name: string };
		stackValue?: number;
	} = {}
): CompiledFunction {
	const paramType = options.paramLabel?.type ?? 'int*';
	const functionId = createFunctionId(name, [paramType]);
	return {
		id: functionId,
		name,
		signature: { parameters: [paramType], returns: [] },
		wasmIndex: 0,
		typeIndex: 0,
		body: [],
		locals: [],
		paramShapeExpansions: options.paramLabel
			? [
					{
						lineNumber: 1,
						parameters: [options.paramLabel],
					},
				]
			: [],
		stackAnalysis:
			options.stackValue !== undefined
				? [
						{
							lineNumber: 1,
							instruction: 'push',
							stackAnalysis: {
								stackBefore: [],
								consumedOperands: [],
								producedStackItems: [{ kind: 'value', valueType: 'int', knownValue: options.stackValue }],
								stackAfter: [{ kind: 'value', valueType: 'int', knownValue: options.stackValue }],
							},
						},
					]
				: [],
		ast: {
			type: 'function',
			name,
			projectBlockId,
			sourceIdentity: {
				projectGroupPath: ROOT_PROJECT_GROUP_PATH,
				codeBlockId: name,
			},
			functionLine: { lineNumber: 0, instruction: 'function', arguments: [{ value: name }] },
			functionEndLine: { lineNumber: 3, instruction: 'functionEnd', arguments: [] },
			signature: { parameters: [paramType], returns: [] },
			lines: [],
		} as unknown as ComposedFunctionAST,
	};
}

describe('getCompiledFunctionForCodeBlock', () => {
	it('builds the projectBlockId index once per compiledFunctions object and avoids Object.values scans', () => {
		const fnA = createTestCompiledFunction('fnA', 10);
		const fnB = createTestCompiledFunction('fnB', 20);
		let propReads = 0;
		const compiledFunctions: NonNullable<ReturnType<typeof createMockState>['compiler']['compiledFunctions']> = {};

		Object.defineProperty(compiledFunctions, fnA.id, {
			enumerable: true,
			get() {
				propReads += 1;
				return fnA;
			},
		});
		Object.defineProperty(compiledFunctions, fnB.id, {
			enumerable: true,
			get() {
				propReads += 1;
				return fnB;
			},
		});

		const state = createMockState({
			compiler: { compiledFunctions },
		});
		const blockA = createCodeBlockGraphicData({ blockType: 'function', creationIndex: 10 });
		const blockB = createCodeBlockGraphicData({ blockType: 'function', creationIndex: 20 });
		const missingBlock = createCodeBlockGraphicData({ blockType: 'function', creationIndex: 99 });
		const valuesSpy = vi.spyOn(Object, 'values');

		try {
			expect(getCompiledFunctionForCodeBlock(blockA, state)).toBe(fnA);
			expect(getCompiledFunctionForCodeBlock(blockB, state)).toBe(fnB);
			expect(getCompiledFunctionForCodeBlock(missingBlock, state)).toBeUndefined();
			expect(getCompiledFunctionForCodeBlock(blockA, state)).toBe(fnA);

			expect(valuesSpy).not.toHaveBeenCalled();
			expect(propReads).toBe(2);
			expect(getCompiledFunctionsByBlockId(compiledFunctions)).toBe(getCompiledFunctionsByBlockId(compiledFunctions));
		} finally {
			valuesSpy.mockRestore();
		}
	});

	it('preserves first-match order when duplicate projectBlockId entries exist', () => {
		const first = createTestCompiledFunction('first', 7);
		const duplicate = createTestCompiledFunction('duplicate', 7);
		const state = createMockState({
			compiler: {
				compiledFunctions: {
					[first.id]: first,
					[duplicate.id]: duplicate,
				},
			},
		});
		const block = createCodeBlockGraphicData({ blockType: 'function', creationIndex: 7 });

		expect(getCompiledFunctionForCodeBlock(block, state)).toBe(first);
	});

	it('updates layout, stack widgets, and tooltips across recompilation, function deletion, and reset', () => {
		const block = createMockCodeBlock({
			name: 'helper',
			blockType: 'function',
			creationIndex: 42,
			lineNumberColumnWidth: 1,
			code: ['function helper', 'push 1', '; @stack', 'functionEnd'],
			cursor: { row: 1, col: 0, x: 0, y: 0 },
		});
		const initialFn = createTestCompiledFunction('helper', 42, {
			paramLabel: { type: 'int*', name: 'initialParam' },
			stackValue: 1,
		});
		const state = createMockState({
			viewport: { vGrid: 8, hGrid: 16 },
			compiler: {
				compiledFunctions: {
					[initialFn.id]: initialFn,
				},
			},
			codeBlockRendering: {
				selectedCodeBlock: block,
			},
		});
		const store = createStateManager(state);
		tooltip(store);

		const runLayoutAndStack = () => {
			block.widgets.shapeDeclarations = [];
			block.widgets.debuggers = [];
			const directiveState = {
				blockState: { disabled: false, isHome: false, isFavorite: false },
				displayState: {},
				displayModel: {
					lines: block.code.map((text, rawRow) => ({ rawRow, text })),
					displayRowToRawRow: [0, 1, 2, 3],
					rawRowToDisplayRow: [0, 1, 2, 3],
					isCollapsed: false,
				},
				layoutContributions: [],
				widgets: [],
			};
			paramShape(block, state, directiveState);
			gaps(block, directiveState);
			updateParamShapeDeclarations(block, state, directiveState);
			createStackDirectiveWidgetContribution({ lineNumber: 2, isTrailing: false }).afterGraphicDataWidthCalculation?.(
				block,
				state,
				directiveState
			);
		};

		runLayoutAndStack();
		expect(block.widgets.shapeDeclarations).toEqual([{ x: 24, y: 32, text: 'int* initialParam' }]);
		expect(block.widgets.debuggers).toContainEqual(expect.objectContaining({ id: 'stack:2', text: '1' }));
		expect(state.tooltip.text).toContain('after: [+int=1]');

		// Recompile with updated function metadata for the same projectBlockId
		const recompiledFn = createTestCompiledFunction('helper', 42, {
			paramLabel: { type: 'float*', name: 'updatedParam' },
			stackValue: 9,
		});
		store.set('compiler.compiledFunctions', {
			[recompiledFn.id]: recompiledFn,
		});

		runLayoutAndStack();
		expect(block.widgets.shapeDeclarations).toEqual([{ x: 24, y: 32, text: 'float* updatedParam' }]);
		expect(block.widgets.debuggers).toContainEqual(expect.objectContaining({ id: 'stack:2', text: '9' }));
		expect(state.tooltip.text).toContain('after: [+int=9]');

		// Delete function / replace project compilation result without block 42
		const unrelatedFn = createTestCompiledFunction('other', 99, {
			paramLabel: { type: 'int*', name: 'otherParam' },
			stackValue: 5,
		});
		store.set('compiler.compiledFunctions', {
			[unrelatedFn.id]: unrelatedFn,
		});

		runLayoutAndStack();
		expect(block.widgets.shapeDeclarations).toEqual([]);
		expect(block.widgets.debuggers).toEqual([]);
		expect(state.tooltip.text).not.toContain('after: [+int=9]');

		// Reset compiledFunctions to undefined
		store.set('compiler.compiledFunctions', undefined);
		expect(getCompiledFunctionForCodeBlock(block, state)).toBeUndefined();
		expect(getCompiledFunctionsByBlockId(state.compiler.compiledFunctions)).toBeUndefined();
	});
});
