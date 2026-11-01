import type { CompilerASTLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('shiftLeft stack analysis', () => {
	it('keeps known integer metadata when shifting known integer operands left', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 2 },
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 2 }
		);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'shiftLeft',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 8 }]);
	});
});
