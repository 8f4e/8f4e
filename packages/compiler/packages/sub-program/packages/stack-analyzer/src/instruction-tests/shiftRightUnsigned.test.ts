import type { CompilerASTLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('shiftRightUnsigned stack analysis', () => {
	it('keeps known integer metadata when shifting known integer operands right as unsigned', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: -8 },
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 1 }
		);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'shiftRightUnsigned',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 2147483644 }]);
	});
});
