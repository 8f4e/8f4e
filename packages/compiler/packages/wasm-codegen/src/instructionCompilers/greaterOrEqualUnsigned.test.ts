import { WASM_F64_GE } from '@8f4e/compiler-wasm-utils';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import greaterOrEqualUnsigned from './greaterOrEqualUnsigned';

describe('greaterOrEqualUnsigned instruction compiler', () => {
	it('emits I32_GE_U for integer operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			greaterOrEqualUnsigned,
			{
				lineNumber: 1,
				instruction: 'greaterOrEqualUnsigned',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'int', isNonZero: false },
					{ kind: 'value', valueType: 'int', isNonZero: false },
				],
				numericOperandKind: 'int32',
			})
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('emits F32_GE for float operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			greaterOrEqualUnsigned,
			{
				lineNumber: 1,
				instruction: 'greaterOrEqualUnsigned',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'float', isNonZero: false },
					{ kind: 'value', valueType: 'float', isNonZero: false },
				],
				numericOperandKind: 'float32',
			})
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('emits F64_GE for float64 operands', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			greaterOrEqualUnsigned,
			{
				lineNumber: 1,
				instruction: 'greaterOrEqualUnsigned',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'float64', isNonZero: false },
					{ kind: 'value', valueType: 'float64', isNonZero: false },
				],
				numericOperandKind: 'float64',
			})
		);

		expect(context.byteCode).toEqual([WASM_F64_GE]);
	});
});
