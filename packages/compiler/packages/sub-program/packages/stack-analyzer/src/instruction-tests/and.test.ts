import type { CompilerASTLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('and stack analysis', () => {
	it('rejects non-integer operands', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'float', isNonZero: false },
			{ kind: 'value', valueType: 'float', isNonZero: false }
		);
		const line = {
			lineNumber: 1,
			instruction: 'and',
			arguments: [],
		} as CompilerASTLine;

		expect(() => {
			analyzeInstruction(line, context);
		}).toThrowError();
	});

	it('keeps known integer metadata when and-ing known integer operands', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 6 },
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 3 }
		);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'and',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 2 }]);
	});
});
