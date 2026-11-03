import type { CompilerASTLine } from '@8f4e/language-spec';
import { BlockType, ErrorCode } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('else stack analysis', () => {
	it('consumes a valid float32 then-branch result without restoring it for the else branch', () => {
		const context = createStackAnalyzerTestContext({
			stack: [{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(1.5) }],
			blockStack: [
				{ blockType: BlockType.MODULE, expectedResultTypes: [] },
				{ blockType: BlockType.CONDITION, expectedResultTypes: ['float'] },
			],
		});

		const facts = analyzeInstruction(
			{
				lineNumber: 7,
				instruction: 'else',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(facts.stackAnalysis).toEqual({
			stackBefore: [{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(1.5) }],
			consumedOperands: [{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(1.5) }],
			producedStackItems: [],
			stackAfter: [],
		});
		expect(context.stack).toEqual([]);
	});

	it.each(['int', 'float64'] as const)('rejects a %s then-branch result when float is expected', valueType => {
		const context = createStackAnalyzerTestContext({
			codeBlockId: 'example',
			codeBlockType: 'module',
			projectBlockId: 12,
			stack: [{ kind: 'value', valueType, isNonZero: true }],
			blockStack: [
				{ blockType: BlockType.MODULE, expectedResultTypes: [] },
				{ blockType: BlockType.CONDITION, expectedResultTypes: ['float'] },
			],
		});
		const line = {
			lineNumber: 7,
			instruction: 'else',
			arguments: [],
		} as CompilerASTLine;

		expect(() => analyzeInstruction(line, context)).toThrow(
			expect.objectContaining({
				code: ErrorCode.ONLY_FLOATS,
				line,
				context: expect.objectContaining({
					codeBlockId: 'example',
					codeBlockType: 'module',
					projectBlockId: 12,
				}),
			})
		);
	});

	it.each(['int', 'float64'] as const)(
		'rejects a %s operand in the first position of a multi-result conditional expecting float',
		valueType => {
			const context = createStackAnalyzerTestContext({
				stack: [
					{ kind: 'value', valueType, isNonZero: true },
					{ kind: 'value', valueType: 'int', isNonZero: true },
				],
				blockStack: [
					{ blockType: BlockType.MODULE, expectedResultTypes: [] },
					{ blockType: BlockType.CONDITION, expectedResultTypes: ['float', 'int'] },
				],
			});
			const line = {
				lineNumber: 8,
				instruction: 'else',
				arguments: [],
			} as CompilerASTLine;

			expect(() => analyzeInstruction(line, context)).toThrow(
				expect.objectContaining({
					code: ErrorCode.ONLY_FLOATS,
					line,
				})
			);
		}
	);

	it.each(['int', 'float64'] as const)(
		'rejects a %s operand in the second position of a multi-result conditional expecting float',
		valueType => {
			const context = createStackAnalyzerTestContext({
				stack: [
					{ kind: 'value', valueType: 'int', isNonZero: true },
					{ kind: 'value', valueType, isNonZero: true },
				],
				blockStack: [
					{ blockType: BlockType.MODULE, expectedResultTypes: [] },
					{ blockType: BlockType.CONDITION, expectedResultTypes: ['int', 'float'] },
				],
			});
			const line = {
				lineNumber: 8,
				instruction: 'else',
				arguments: [],
			} as CompilerASTLine;

			expect(() => analyzeInstruction(line, context)).toThrow(
				expect.objectContaining({
					code: ErrorCode.ONLY_FLOATS,
					line,
				})
			);
		}
	);
});
