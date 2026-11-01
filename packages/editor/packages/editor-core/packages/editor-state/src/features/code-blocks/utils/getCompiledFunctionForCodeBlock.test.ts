import {
	type CompiledFunction,
	type ComposedFunctionAST,
	createFunctionId,
	ROOT_PROJECT_GROUP_PATH,
} from '@8f4e/language-spec';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '../../../pureHelpers/testingUtils/testUtils';
import gaps from '../gaps';
import type { BlockLayoutDraft } from '../layout/types';
import paramShape, { updateParamShapeDeclarations } from '../paramShape/updateGraphicData';
import { createCodeBlockGraphicData } from './createCodeBlockGraphicData';
import { getCompiledFunctionForCodeBlock, getCompiledFunctionsByBlockId } from './getCompiledFunctionForCodeBlock';

function createTestCompiledFunction(
	name: string,
	projectBlockId: number,
	options: {
		paramLabel?: { type: 'int*' | 'float*'; name: string };
	} = {}
): CompiledFunction {
	const paramType = options.paramLabel?.type ?? 'int*';
	const functionId = createFunctionId(name, [paramType]);
	return {
		id: functionId,
		name,
		signature: { parameters: [{ name: 'value', type: paramType }], returns: [] },
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
		stackAnalysis: [],
		ast: {
			type: 'function',
			name,
			projectBlockId,
			sourceIdentity: {
				projectGroupPath: ROOT_PROJECT_GROUP_PATH,
				codeBlockId: name,
			},
			functionLine: { lineNumber: 0, instruction: 'function', arguments: [{ value: name }] },
			functionEndLine: { lineNumber: 2, instruction: 'functionEnd', arguments: [] },
			signature: { parameters: [{ name: 'value', type: paramType }], returns: [] },
			lines: [],
		} as unknown as ComposedFunctionAST,
	};
}

describe('getCompiledFunctionForCodeBlock', () => {
	it('builds the projectBlockId index once per compiledFunctions object and avoids Object.values scans', () => {
		const fnA = createTestCompiledFunction('fnA', 10);
		const fnB = createTestCompiledFunction('fnB', 20);
		let propReads = 0;
		const compiledFunctions: NonNullable<
			ReturnType<typeof createMockState>['compiler']['result']['compiledFunctions']
		> = {};

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
			compiler: { result: { compiledFunctions } },
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
				result: {
					compiledFunctions: {
						[first.id]: first,
						[duplicate.id]: duplicate,
					},
				},
			},
		});
		const block = createCodeBlockGraphicData({ blockType: 'function', creationIndex: 7 });

		expect(getCompiledFunctionForCodeBlock(block, state)).toBe(first);
	});

	it('updates parameter layout across recompilation, function deletion, and reset', () => {
		const block = createMockCodeBlock({
			name: 'helper',
			blockType: 'function',
			creationIndex: 42,
			lineNumberColumnWidth: 1,
			code: ['function helper', 'paramShape parameters', 'functionEnd'],
		});
		const initialFn = createTestCompiledFunction('helper', 42, {
			paramLabel: { type: 'int*', name: 'initialParam' },
		});
		const state = createMockState({
			viewport: { vGrid: 8, hGrid: 16 },
			compiler: {
				result: {
					compiledFunctions: {
						[initialFn.id]: initialFn,
					},
				},
			},
		});
		const store = createStateManager(state);

		const runLayout = () => {
			block.widgets.shapeDeclarations = [];
			const blockLayout: BlockLayoutDraft = {
				displayModel: {
					lines: block.code.map((text, sourceLineIndex) => ({ sourceLineIndex, text })),
					displayRowToSourceLineIndex: [0, 1, 2],
					sourceLineIndexToDisplayRow: [0, 1, 2],
					isCollapsed: false,
				},
				verticalSpaceAfterSourceLine: [],
			};
			paramShape(block, state, blockLayout);
			gaps(block, blockLayout);
			updateParamShapeDeclarations(block, state, blockLayout);
		};

		runLayout();
		expect(block.widgets.shapeDeclarations).toEqual([{ x: 24, y: 32, text: 'int* initialParam' }]);

		// Recompile with updated function metadata for the same projectBlockId
		const recompiledFn = createTestCompiledFunction('helper', 42, {
			paramLabel: { type: 'float*', name: 'updatedParam' },
		});
		store.set('compiler.result', {
			...state.compiler.result,
			compiledFunctions: { [recompiledFn.id]: recompiledFn },
		});

		runLayout();
		expect(block.widgets.shapeDeclarations).toEqual([{ x: 24, y: 32, text: 'float* updatedParam' }]);

		// Delete function / replace project compilation result without block 42
		const unrelatedFn = createTestCompiledFunction('other', 99, {
			paramLabel: { type: 'int*', name: 'otherParam' },
		});
		store.set('compiler.result', {
			...state.compiler.result,
			compiledFunctions: { [unrelatedFn.id]: unrelatedFn },
		});

		runLayout();
		expect(block.widgets.shapeDeclarations).toEqual([]);

		// Reset compiledFunctions to undefined
		store.set('compiler.result', { ...state.compiler.result, compiledFunctions: undefined });
		runLayout();
		expect(block.widgets.shapeDeclarations).toEqual([]);
		expect(getCompiledFunctionForCodeBlock(block, state)).toBeUndefined();
		expect(getCompiledFunctionsByBlockId(state.compiler.result.compiledFunctions)).toBeUndefined();
		store.dispose();
	});
});
