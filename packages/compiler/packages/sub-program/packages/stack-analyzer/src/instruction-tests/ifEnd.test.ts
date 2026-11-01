import type { CompilerASTLine } from '@8f4e/language-spec';
import { BlockType, ErrorCode } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('ifEnd stack analysis', () => {
	it('accepts and restores a valid float32 else-branch result', () => {
		const context = createStackAnalyzerTestContext({
			stack: [{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(3.5) }],
			blockStack: [
				{ blockType: BlockType.MODULE, expectedResultTypes: [] },
				{ blockType: BlockType.CONDITION, expectedResultTypes: ['float'] },
			],
		});

		const facts = analyzeInstruction(
			{
				lineNumber: 9,
				instruction: 'ifEnd',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(facts.stackAnalysis.producedStackItems).toEqual([
			{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(3.5) },
		]);
		expect(context.stack).toEqual([
			{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(3.5) },
		]);
	});

	it('accepts and restores multi-result conditional values in order', () => {
		const context = createStackAnalyzerTestContext({
			stack: [
				{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(1.5) },
				{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 4 },
			],
			blockStack: [
				{ blockType: BlockType.MODULE, expectedResultTypes: [] },
				{ blockType: BlockType.CONDITION, expectedResultTypes: ['float', 'int'] },
			],
		});

		const facts = analyzeInstruction(
			{
				lineNumber: 10,
				instruction: 'ifEnd',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(facts.stackAnalysis.producedStackItems).toEqual([
			{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(1.5) },
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 4 },
		]);
		expect(context.stack).toEqual([
			{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(1.5) },
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 4 },
		]);
	});

	it.each(['int', 'float64'] as const)('rejects a %s else-branch result when float is expected', valueType => {
		const context = createStackAnalyzerTestContext({
			codeBlockId: 'example',
			codeBlockType: 'module',
			projectBlockId: 13,
			stack: [{ kind: 'value', valueType, isNonZero: true }],
			blockStack: [
				{ blockType: BlockType.MODULE, expectedResultTypes: [] },
				{ blockType: BlockType.CONDITION, expectedResultTypes: ['float'] },
			],
		});
		const line = {
			lineNumber: 9,
			instruction: 'ifEnd',
			arguments: [],
		} as CompilerASTLine;

		expect(() => analyzeInstruction(line, context)).toThrow(
			expect.objectContaining({
				code: ErrorCode.ONLY_FLOATS,
				line,
				context: expect.objectContaining({
					codeBlockId: 'example',
					codeBlockType: 'module',
					projectBlockId: 13,
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
				lineNumber: 10,
				instruction: 'ifEnd',
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
				lineNumber: 10,
				instruction: 'ifEnd',
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
