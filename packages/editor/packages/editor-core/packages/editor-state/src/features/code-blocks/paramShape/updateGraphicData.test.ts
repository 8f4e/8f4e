import { type CompiledFunction, createFunctionId, type ValidatedFunctionAST } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { createMockState } from '../../../pureHelpers/testingUtils/testUtils';
import gaps from '../gaps';
import type { BlockLayoutDraft } from '../layout/types';
import { createCodeBlockGraphicData } from '../utils/createCodeBlockGraphicData';
import paramShape, { updateParamShapeDeclarations } from './updateGraphicData';

function createLayoutDraft(): BlockLayoutDraft {
	return {
		displayModel: {
			lines: [],
			displayRowToSourceLineIndex: [],
			sourceLineIndexToDisplayRow: [],
			isCollapsed: false,
		},
		verticalSpaceAfterSourceLine: [],
	};
}

function createCompiledFunction(projectBlockId: number): CompiledFunction {
	const functionId = createFunctionId('foo', ['int*', 'float*']);
	return {
		id: functionId,
		name: 'foo',
		signature: { parameters: ['int*', 'float*'], returns: [] },
		wasmIndex: 0,
		typeIndex: 0,
		body: [],
		locals: [],
		paramShapeExpansions: [
			{
				lineNumber: 2,
				parameters: [
					{ type: 'int*', name: 'a' },
					{ type: 'float*', name: 'b' },
				],
			},
		],
		ast: {
			type: 'function',
			id: 'foo',
			projectBlockId,
			functionLine: { lineNumber: 0, instruction: 'function', arguments: [{ value: 'foo' }] },
			functionEndLine: { lineNumber: 4, instruction: 'functionEnd', arguments: [] },
			signature: { parameters: ['int*', 'float*'], returns: [] },
			lines: [
				{ lineNumber: 0, instruction: 'function', arguments: [{ value: 'foo' }] },
				{ lineNumber: 1, instruction: '#impure', arguments: [] },
				{ lineNumber: 2, instruction: 'paramShape', arguments: [{ value: 'bar' }] },
				{ lineNumber: 3, instruction: 'push', arguments: [{ value: '*a' }] },
				{ lineNumber: 4, instruction: 'functionEnd', arguments: [] },
			],
		} as unknown as ValidatedFunctionAST,
	} as CompiledFunction;
}

describe('paramShape', () => {
	it('precomputes effective function parameter labels under paramShape lines', () => {
		const func = createCodeBlockGraphicData({
			blockType: 'function',
			code: ['function foo', '#impure', 'paramShape bar', 'push *a', 'functionEnd'],
			lineNumberColumnWidth: 1,
			creationIndex: 42,
		});
		const state = createMockState({
			viewport: {
				vGrid: 8,
				hGrid: 16,
			},
			compiler: {
				result: {
					compiledFunctions: {
						[createFunctionId('foo', ['float*'])]: {
							id: createFunctionId('foo', ['float*']),
							name: 'foo',
							ast: { projectBlockId: 99 },
							paramShapeExpansions: [
								{
									lineNumber: 2,
									parameters: [{ type: 'float*', name: 'wrong' }],
								},
							],
						} as CompiledFunction,
						[createFunctionId('foo', ['int*', 'float*'])]: createCompiledFunction(42),
					},
				},
			},
		});
		const blockLayout = {
			...createLayoutDraft(),
			displayModel: {
				lines: [
					{ sourceLineIndex: 0, text: 'function foo' },
					{ sourceLineIndex: 1, text: '#impure' },
					{ sourceLineIndex: 2, text: 'paramShape bar' },
					{ sourceLineIndex: 3, text: 'push *a' },
					{ sourceLineIndex: 4, text: 'functionEnd' },
				],
				displayRowToSourceLineIndex: [0, 1, 2, 3, 4],
				sourceLineIndexToDisplayRow: [0, 1, 2, 3, 4],
				isCollapsed: false,
			},
		};

		blockLayout.verticalSpaceAfterSourceLine.push({ sourceLineIndex: 1, heightInRows: 1 });

		paramShape(func, state, blockLayout);
		gaps(func, blockLayout);
		updateParamShapeDeclarations(func, state, blockLayout);

		expect(blockLayout.verticalSpaceAfterSourceLine).toEqual([
			{ sourceLineIndex: 1, heightInRows: 1 },
			{ sourceLineIndex: 2, heightInRows: 2 },
		]);
		expect(func.widgets.shapeDeclarations).toEqual([
			{ x: 24, y: 64, text: 'int* a' },
			{ x: 24, y: 80, text: 'float* b' },
		]);
	});
});
