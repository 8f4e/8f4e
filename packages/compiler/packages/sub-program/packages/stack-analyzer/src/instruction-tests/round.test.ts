import type { CompilerASTLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('round stack analysis', () => {
	it('preserves float64 operand precision', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push({ kind: 'value', valueType: 'float64', isNonZero: true });

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'round',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([{ kind: 'value', valueType: 'float64', isNonZero: false }]);
	});
});
