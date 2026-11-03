import type { CompilerASTLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('xor stack analysis', () => {
	it('keeps known integer metadata when xor-ing known integer operands', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 6 },
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 3 }
		);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'xor',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 5 }]);
	});
});
