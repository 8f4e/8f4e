import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, {
	compileInstructionForTest,
	createStackFacts,
} from '../../tests/testUtils';
import store from './store';

describe('store instruction compiler', () => {
	it.each([
		['int8', 1, 58, 0],
		['int8u', 1, 58, 0],
		['int16', 2, 59, 1],
		['int16u', 2, 59, 1],
	] as const)('uses the %s pointee width when proving a store safe', (baseType, width, opcode, alignment) => {
		const context = createInstructionCompilerTestContext();
		compileInstructionForTest(
			store,
			{ diagnosticSource: { kind: 'document' }, lineNumber: 1, instruction: 'store', arguments: [] },
			context,
			createStackFacts({
				consumedOperands: [
					{
						kind: 'address',
						valueType: 'int',
						address: { safeAccessByteWidth: width },
						pointsTo: { baseType, pointerDepth: 1 },
					},
					{ kind: 'value', valueType: 'int' },
				],
			})
		);

		expect(context.instructions).toEqual([{ kind: 'memoryAccess', opcode, alignment, offset: 0 }]);
	});

	it('stores to a safe memory address', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			store,
			{ diagnosticSource: { kind: 'document' }, lineNumber: 1, instruction: 'store', arguments: [] },
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
								memoryId: 0,
							},
						},
					},
					{ kind: 'value', valueType: 'int', isNonZero: false },
				],
			})
		);

		expect({
			instructions: context.instructions,
		}).toMatchSnapshot();
	});

	it('stores to an unsafe memory address with a bounds guard', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			store,
			{ diagnosticSource: { kind: 'document' }, lineNumber: 2, instruction: 'store', arguments: [] },
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'int', isNonZero: false },
					{ kind: 'value', valueType: 'int', isNonZero: false },
				],
			})
		);

		expect({
			instructions: context.instructions,
		}).toMatchSnapshot();
	});

	it('emits f64.store (opcode 57) for float64 value at safe address', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			store,
			{ diagnosticSource: { kind: 'document' }, lineNumber: 3, instruction: 'store', arguments: [] },
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
								memoryId: 0,
							},
						},
					},
					{ kind: 'value', valueType: 'float64', isNonZero: false },
				],
			})
		);

		expect(context.instructions).toContainEqual(expect.objectContaining({ kind: 'memoryAccess', opcode: 57 })); // F64_STORE opcode
		expect(context.instructions).not.toContainEqual(expect.objectContaining({ kind: 'memoryAccess', opcode: 56 })); // no F32_STORE
		expect(context.instructions).not.toContain(54); // no I32_STORE
	});

	it('emits f32.store (opcode 56) for float32 value at safe address, not f64.store', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			store,
			{ diagnosticSource: { kind: 'document' }, lineNumber: 4, instruction: 'store', arguments: [] },
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
								memoryId: 0,
							},
						},
					},
					{ kind: 'value', valueType: 'float', isNonZero: false },
				],
			})
		);

		expect(context.instructions).toContainEqual(expect.objectContaining({ kind: 'memoryAccess', opcode: 56 })); // F32_STORE opcode
		expect(context.instructions).not.toContainEqual(expect.objectContaining({ kind: 'memoryAccess', opcode: 57 })); // no F64_STORE
	});

	it('emits f64.store for float64 value at unsafe address', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			store,
			{ diagnosticSource: { kind: 'document' }, lineNumber: 5, instruction: 'store', arguments: [] },
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'value', valueType: 'int', isNonZero: false },
					{ kind: 'value', valueType: 'float64', isNonZero: false },
				],
			})
		);

		expect(context.instructions).toContainEqual(expect.objectContaining({ kind: 'memoryAccess', opcode: 57 })); // F64_STORE opcode
		expect(context.instructions).not.toContainEqual(expect.objectContaining({ kind: 'memoryAccess', opcode: 56 })); // no F32_STORE
	});

	it('does not guard when an explicit clamp proves the access width is safe', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			store,
			{ diagnosticSource: { kind: 'document' }, lineNumber: 6, instruction: 'store', arguments: [] },
			context,
			createStackFacts({
				consumedOperands: [
					{ kind: 'address', valueType: 'int', isNonZero: false, address: { safeAccessByteWidth: 4 } },
					{ kind: 'value', valueType: 'int', isNonZero: false },
				],
			})
		);

		expect(context.instructions).not.toContainEqual({ kind: 'memory.size' });
	});
});
