import type {
	ResolvedMemoryDeclaration,
	ResolvedMemoryPointerPushLine,
	ResolvedMemoryPushLine,
} from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext, { compileInstructionForTest } from '../../tests/testUtils';
import push from './push';

const { classifyIdentifier } = await import('@8f4e/tokenizer');

function resolvedMemoryPushLine(id: string, memoryItem: ResolvedMemoryDeclaration): ResolvedMemoryPushLine {
	return {
		lineNumber: 1,
		instruction: 'push',
		arguments: [classifyIdentifier(id)],
		resolvedTarget: { kind: 'memory', memoryItem },
	};
}

function resolvedMemoryPointerPushLine(
	id: string,
	memoryItem: ResolvedMemoryDeclaration
): ResolvedMemoryPointerPushLine {
	return {
		lineNumber: 1,
		instruction: 'push',
		arguments: [
			{
				type: ArgumentType.IDENTIFIER,
				value: `*${id}`,
				referenceKind: 'memory-pointer',
				scope: 'local',
				targetMemoryId: id,
				dereferenceDepth: 1,
			},
		],
		resolvedTarget: { kind: 'memory-pointer', memoryItem },
	};
}

function createMemoryItem(
	overrides: Partial<ResolvedMemoryDeclaration> & Pick<ResolvedMemoryDeclaration, 'id' | 'byteAddress'>
) {
	return {
		numberOfElements: 1,
		elementWordSize: 4,
		allocationUnitAddress: 0,
		allocationUnitCount: 1,
		isInteger: true,
		pointerDepth: 0,
		isUnsigned: false,
		type: 'int',
		lineNumber: 1,
		...overrides,
	} as ResolvedMemoryDeclaration;
}

describe('push instruction compiler', () => {
	it('pushes a literal value', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			push,
			{
				lineNumber: 1,
				instruction: 'push',
				arguments: [{ type: ArgumentType.LITERAL, value: 5, isInteger: true }],
			},
			context
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('pushes a resolved literal value', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			push,
			{
				lineNumber: 1,
				instruction: 'push',
				arguments: [{ type: ArgumentType.LITERAL, value: 42, isInteger: true }],
			},
			context
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('pushes a f64 literal value emitting f64.const', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			push,
			{
				lineNumber: 1,
				instruction: 'push',
				arguments: [
					{
						type: ArgumentType.LITERAL,
						value: 3.14,
						isInteger: false,
						isFloat64: true,
					},
				],
			},
			context
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('pushes a resolved f64 literal emitting f64.const', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			push,
			{
				lineNumber: 1,
				instruction: 'push',
				arguments: [
					{
						type: ArgumentType.LITERAL,
						value: 3.141592653589793,
						isInteger: false,
						isFloat64: true,
					},
				],
			},
			context
		);

		expect({
			byteCode: context.byteCode,
		}).toMatchSnapshot();
	});

	it('float32 literal push does not emit f64.const', () => {
		const context = createInstructionCompilerTestContext();

		compileInstructionForTest(
			push,
			{
				lineNumber: 1,
				instruction: 'push',
				arguments: [{ type: ArgumentType.LITERAL, value: 3.14, isInteger: false }],
			},
			context
		);

		// f32.const opcode is 67 (0x43), f64.const opcode is 68 (0x44)
		expect(context.byteCode[0]).toBe(67);
	});

	describe('float64 memory push', () => {
		it('pushes a float64 memory identifier using f64.load', () => {
			const memoryItem = createMemoryItem({
				id: 'myF64',
				byteAddress: 0,
				elementWordSize: 8,
				isInteger: false,
				isFloat64: true,
				type: 'float64',
			});
			const context = createInstructionCompilerTestContext();

			compileInstructionForTest(push, resolvedMemoryPushLine('myF64', memoryItem), context);

			expect({
				byteCode: context.byteCode,
			}).toMatchSnapshot();
		});

		it('emits f64.load (opcode 43) for float64 memory', () => {
			const memoryItem = createMemoryItem({
				id: 'myF64',
				byteAddress: 0,
				elementWordSize: 8,
				isInteger: false,
				isFloat64: true,
				type: 'float64',
			});
			const context = createInstructionCompilerTestContext();

			compileInstructionForTest(push, resolvedMemoryPushLine('myF64', memoryItem), context);

			// byteCode: i32const(0) + f64load() = [65, 0, 43, 3, 0]
			expect(context.byteCode).toContain(43); // F64_LOAD opcode
		});

		it('emits f32.load (opcode 42) for float32 memory, not f64.load', () => {
			const memoryItem = createMemoryItem({
				id: 'myF32',
				byteAddress: 0,
				elementWordSize: 4,
				isInteger: false,
				type: 'float',
			});
			const context = createInstructionCompilerTestContext();

			compileInstructionForTest(push, resolvedMemoryPushLine('myF32', memoryItem), context);

			expect(context.byteCode).toContain(42); // F32_LOAD opcode
			expect(context.byteCode).not.toContain(43); // no F64_LOAD
		});

		it('dereferencing float64* emits f64.load', () => {
			const memoryItem = createMemoryItem({
				id: 'floatPointer',
				byteAddress: 0,
				type: 'float64*',
				pointeeBaseType: 'float64',
				pointerDepth: 1,
			});
			const context = createInstructionCompilerTestContext();

			compileInstructionForTest(push, resolvedMemoryPointerPushLine('floatPointer', memoryItem), context);

			expect(context.byteCode).toContain(43); // F64_LOAD opcode
		});

		it('dereferencing float64** once emits an integer load', () => {
			const memoryItem = createMemoryItem({
				id: 'floatPointerPointer',
				byteAddress: 0,
				type: 'float64**',
				pointeeBaseType: 'float64',
				pointerDepth: 2,
			});
			const context = createInstructionCompilerTestContext();

			compileInstructionForTest(push, resolvedMemoryPointerPushLine('floatPointerPointer', memoryItem), context);

			expect(context.byteCode).not.toContain(43); // no F64_LOAD opcode for one-level dereference
		});

		it('handles mixed int32/float32/float64 memory layout', () => {
			const memory = {
				myInt: createMemoryItem({ id: 'myInt', byteAddress: 0, elementWordSize: 4, isInteger: true }),
				myFloat: createMemoryItem({
					id: 'myFloat',
					byteAddress: 4,
					elementWordSize: 4,
					isInteger: false,
					type: 'float',
				}),
				myF64: createMemoryItem({
					id: 'myF64',
					byteAddress: 8,
					elementWordSize: 8,
					isInteger: false,
					isFloat64: true,
					type: 'float64',
				}),
			};
			const context = createInstructionCompilerTestContext();

			const contextInt = {
				...context,
				byteCode: [] as typeof context.byteCode,
			};
			compileInstructionForTest(push, resolvedMemoryPushLine('myInt', memory.myInt), contextInt);

			expect(contextInt.byteCode).not.toContain(42);
			expect(contextInt.byteCode).not.toContain(43);

			const contextFloat = {
				...context,
				byteCode: [] as typeof context.byteCode,
			};
			compileInstructionForTest(push, resolvedMemoryPushLine('myFloat', memory.myFloat), contextFloat);

			expect(contextFloat.byteCode).toContain(42); // F32_LOAD

			const contextF64 = {
				...context,
				byteCode: [] as typeof context.byteCode,
			};
			compileInstructionForTest(push, resolvedMemoryPushLine('myF64', memory.myF64), contextF64);

			expect(contextF64.byteCode).toContain(43); // F64_LOAD
		});
	});
});
