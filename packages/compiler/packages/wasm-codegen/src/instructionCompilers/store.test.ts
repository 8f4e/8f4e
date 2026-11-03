import { WASM_MEMORY_SIZE } from '@8f4e/compiler-wasm-utils';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import store from './store';

describe('store instruction compiler', () => {
	it('stores to a safe memory address', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			store,
			{
				lineNumber: 1,
				instruction: 'store',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{
						kind: 'address',
						valueType: 'int',
						isNonZero: false,
						address: {
							safeRange: {
								source: 'memory-start',
								byteAddress: 0,
								safeByteLength: 4,
								memoryId: 'test',
							},
						},
					},
					{ kind: 'value', valueType: 'int', isNonZero: false },
				],
			})
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('stores to an unsafe memory address with a bounds guard', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			store,
			{
				lineNumber: 2,
				instruction: 'store',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'int', isNonZero: false },
					{ kind: 'value', valueType: 'int', isNonZero: false },
				],
			})
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('emits f64.store (opcode 57) for float64 value at safe address', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			store,
			{
				lineNumber: 3,
				instruction: 'store',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
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
					{ kind: 'value', valueType: 'float64', isNonZero: false },
				],
			})
		);

		expect(context.byteCode).toContain(57); // F64_STORE opcode
		expect(context.byteCode).not.toContain(56); // no F32_STORE
		expect(context.byteCode).not.toContain(54); // no I32_STORE
	});

	it('emits f32.store (opcode 56) for float32 value at safe address, not f64.store', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			store,
			{
				lineNumber: 4,
				instruction: 'store',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{
						kind: 'address',
						valueType: 'int',
						isNonZero: false,
						address: {
							safeRange: {
								source: 'memory-start',
								byteAddress: 0,
								safeByteLength: 4,
								memoryId: 'test',
							},
						},
					},
					{ kind: 'value', valueType: 'float', isNonZero: false },
				],
			})
		);

		expect(context.byteCode).toContain(56); // F32_STORE opcode
		expect(context.byteCode).not.toContain(57); // no F64_STORE
	});

	it('emits f64.store for float64 value at unsafe address', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			store,
			{
				lineNumber: 5,
				instruction: 'store',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'int', isNonZero: false },
					{ kind: 'value', valueType: 'float64', isNonZero: false },
				],
			})
		);

		expect(context.byteCode).toContain(57); // F64_STORE opcode
		expect(context.byteCode).not.toContain(56); // no F32_STORE
	});

	it('does not guard when an explicit clamp proves the access width is safe', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			store,
			{
				lineNumber: 6,
				instruction: 'store',
				arguments: [],
			},
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'address', valueType: 'int', isNonZero: false, address: { safeAccessByteWidth: 4 } },
					{ kind: 'value', valueType: 'int', isNonZero: false },
				],
			})
		);

		expect(context.byteCode).not.toContain(WASM_MEMORY_SIZE);
	});
});
