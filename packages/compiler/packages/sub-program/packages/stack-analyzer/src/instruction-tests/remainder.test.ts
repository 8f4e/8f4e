import type { CompilerASTLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('remainder stack analysis', () => {
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
					instruction: 'remainder',
					arguments: [],
				} as CompilerASTLine,
				context
			);
		}).toThrowError();
	});

	it('keeps known integer metadata when taking the remainder of known integer operands', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 9 },
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 4 }
		);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'remainder',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 1 }]);
	});
});
