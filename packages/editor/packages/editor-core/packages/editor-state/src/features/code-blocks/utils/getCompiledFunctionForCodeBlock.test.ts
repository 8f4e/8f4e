import {
	type CompiledFunction,
	type ComposedFunctionAST,
	createFunctionId,
	ROOT_PROJECT_GROUP_PATH,
} from '@8f4e/language-spec';
import { describe, expect, it, vi } from 'vitest';
import { createMockState } from '../../../pureHelpers/testingUtils/testUtils';
import { createCodeBlockGraphicData } from './createCodeBlockGraphicData';
import { getCompiledFunctionForCodeBlock, getCompiledFunctionsByBlockId } from './getCompiledFunctionForCodeBlock';

function createTestCompiledFunction(name: string, projectBlockId: number): CompiledFunction {
	const paramType = 'int*';
	const functionId = createFunctionId(name, [paramType]);
	return {
		id: functionId,
		name,
		signature: { parameters: [{ name: 'value', type: paramType }], returns: [] },
		analysis: { isImported: false, hasExplicitReturn: false, hasEarlyReturn: false, isRecursive: false },
		wasmIndex: 0,
		typeIndex: 0,
		body: [],
		locals: [],
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
});
