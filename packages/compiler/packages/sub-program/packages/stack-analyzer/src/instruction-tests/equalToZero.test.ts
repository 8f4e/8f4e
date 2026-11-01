import type { CompilerASTLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('equalToZero stack analysis', () => {
	it('emits I32_EQZ for integer operands', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push({ kind: 'value', valueType: 'int', isNonZero: false });

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'equalToZero',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: false }]);
	});

	it('emits F32_EQ for float32 operands', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push({ kind: 'value', valueType: 'float', isNonZero: false });

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'equalToZero',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: false }]);
	});

	it('emits F64_EQ for float64 operands', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push({ kind: 'value', valueType: 'float64', isNonZero: false });

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'equalToZero',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: false }]);
	});
});
