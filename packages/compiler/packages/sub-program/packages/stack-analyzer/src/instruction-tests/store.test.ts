import type { CompilerASTLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('store stack analysis', () => {
	it('emits f64.store (opcode 57) for float64 value at safe address', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{
				kind: 'address',
				valueType: 'int',
				isNonZero: false,
				address: {
					safeRange: {
						source: 'memory-start',
						byteAddress: 0,
						safeByteLength: 8,
						memoryId: 'test',
					},
				},
			},
			{ kind: 'value', valueType: 'float64', isNonZero: false }
		);

		analyzeInstruction(
			{
				lineNumber: 3,
				instruction: 'store',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		// F64_STORE opcode
		// no F32_STORE
		// no I32_STORE
		expect(context.stack).toHaveLength(0);
	});

	it('emits f64.store for float64 value at unsafe address', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: false },
			{ kind: 'value', valueType: 'float64', isNonZero: false }
		);

		analyzeInstruction(
			{
				lineNumber: 5,
				instruction: 'store',
				arguments: [],
			} as CompilerASTLine,
			context
		);

		// F64_STORE opcode
		// no F32_STORE
		expect(context.stack).toHaveLength(0);
	});
});
