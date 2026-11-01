import type { CompilerASTLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('lessThan stack analysis', () => {
	it('emits F64_LT for float64 operands', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'float64', isNonZero: false },
			{ kind: 'value', valueType: 'float64', isNonZero: false }
		);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'lessThan',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: false }]);
	});
});
