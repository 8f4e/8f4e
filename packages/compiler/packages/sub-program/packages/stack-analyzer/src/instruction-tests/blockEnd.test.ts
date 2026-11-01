import type { CompilerASTLine } from '@8f4e/language-spec';
import { BlockType, ErrorCode } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('blockEnd stack analysis', () => {
	it('accepts and restores a float32 result when float is expected', () => {
		const context = createStackAnalyzerTestContext({
			stack: [{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(2.5) }],
			blockStack: [
				{ blockType: BlockType.MODULE, expectedResultTypes: [] },
				{ blockType: BlockType.BLOCK, expectedResultTypes: ['float'] },
			],
		});

		const facts = analyzeInstruction(
			{
				lineNumber: 6,
				instruction: 'blockEnd',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(facts.stackAnalysis).toEqual({
			stackBefore: [{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(2.5) }],
			consumedOperands: [{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(2.5) }],
			producedStackItems: [{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(2.5) }],
			stackAfter: [{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(2.5) }],
		});
		expect(context.stack).toEqual([
			{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(2.5) },
		]);
	});

	it('accepts and restores an integer result when int is expected', () => {
		const context = createStackAnalyzerTestContext({
			stack: [{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 7 }],
			blockStack: [
				{ blockType: BlockType.MODULE, expectedResultTypes: [] },
				{ blockType: BlockType.BLOCK, expectedResultTypes: ['int'] },
			],
		});

		const facts = analyzeInstruction(
			{
				lineNumber: 6,
				instruction: 'blockEnd',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(facts.stackAnalysis.producedStackItems).toEqual([
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 7 },
		]);
		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 7 }]);
	});

	it.each(['int', 'float64'] as const)('rejects a %s operand when float is expected', valueType => {
		const context = createStackAnalyzerTestContext({
			codeBlockId: 'example',
			codeBlockType: 'module',
			projectBlockId: 11,
			stack: [{ kind: 'value', valueType, isNonZero: true }],
			blockStack: [
				{ blockType: BlockType.MODULE, expectedResultTypes: [] },
				{ blockType: BlockType.BLOCK, expectedResultTypes: ['float'] },
			],
		});
		const line = {
			lineNumber: 6,
			instruction: 'blockEnd',
			arguments: [],
		} as CompilerASTLine;

		expect(() => analyzeInstruction(line, context)).toThrow(
			expect.objectContaining({
				code: ErrorCode.ONLY_FLOATS,
				line,
				context: expect.objectContaining({
					codeBlockId: 'example',
					codeBlockType: 'module',
					projectBlockId: 11,
				}),
			})
		);
	});

	it.each(['float', 'float64'] as const)('rejects a %s operand when int is expected', valueType => {
		const context = createStackAnalyzerTestContext({
			stack: [{ kind: 'value', valueType, isNonZero: true }],
			blockStack: [
				{ blockType: BlockType.MODULE, expectedResultTypes: [] },
				{ blockType: BlockType.BLOCK, expectedResultTypes: ['int'] },
			],
		});
		const line = {
			lineNumber: 6,
			instruction: 'blockEnd',
			arguments: [],
		} as CompilerASTLine;

		expect(() => analyzeInstruction(line, context)).toThrow(
			expect.objectContaining({
				code: ErrorCode.ONLY_INTEGERS,
				line,
			})
		);
	});

	it('throws INSUFFICIENT_OPERANDS when the stack has no value for a result-producing block', () => {
		const context = createStackAnalyzerTestContext({
			stack: [],
			blockStack: [
				{ blockType: BlockType.MODULE, expectedResultTypes: [] },
				{ blockType: BlockType.BLOCK, expectedResultTypes: ['float'] },
			],
		});
		const line = {
			lineNumber: 6,
			instruction: 'blockEnd',
			arguments: [],
		} as CompilerASTLine;

		expect(() => analyzeInstruction(line, context)).toThrow(
			expect.objectContaining({
				code: ErrorCode.INSUFFICIENT_OPERANDS,
				line,
			})
		);
	});
});
