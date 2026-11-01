import type { CompilerASTLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('div stack analysis', () => {
	it('throws on division by zero', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: true },
			{ kind: 'value', valueType: 'int', isNonZero: false }
		);

		expect(() => {
			analyzeInstruction(
				{
					lineNumber: 1,
					instruction: 'div',
					arguments: [],
				} as CompilerASTLine,
				context
			);
		}).toThrowError();
	});

	it('keeps known integer metadata when dividing known integer operands', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 8 },
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 4 }
		);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'div',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 2 }]);
	});

	it('marks known zero integer division results as zero', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 1 },
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 2 }
		);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'div',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: false, knownValue: 0 }]);
	});
});
