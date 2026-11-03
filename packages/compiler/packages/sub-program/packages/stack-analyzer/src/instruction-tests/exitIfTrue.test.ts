import type { CompilerASTLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('exitIfTrue stack analysis', () => {
	it('emits a conditional early module exit and preserves the fallthrough stack', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push({ kind: 'value', valueType: 'float', isNonZero: false });
		context.stack.push({ kind: 'value', valueType: 'int', isNonZero: false });

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'exitIfTrue',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([{ kind: 'value', valueType: 'float', isNonZero: false }]);
	});
});
