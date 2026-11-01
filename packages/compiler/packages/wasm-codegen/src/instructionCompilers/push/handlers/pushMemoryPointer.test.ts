import { f64load, i32const, i32load, i32load8s, i32load8u, i32load16s, i32load16u } from '@8f4e/compiler-wasm-utils';
import type { ResolvedMemoryDeclaration, ResolvedMemoryPointerPushLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import createInstructionCompilerTestContext from '../../../../tests/testUtils';
import pushMemoryPointer from './pushMemoryPointer';

const { classifyIdentifier } = await import('@8f4e/tokenizer');

function createResolvedMemoryPointerPushLine(
	memoryId: string,
	memoryItem: ResolvedMemoryDeclaration,
	dereferenceDepth = 1
): ResolvedMemoryPointerPushLine {
	return {
		lineNumber: 1,
		instruction: 'push',
		arguments: [classifyIdentifier(`${'*'.repeat(dereferenceDepth)}${memoryId}`)],
		resolvedTarget: { kind: 'memory-pointer', memoryItem },
	} as ResolvedMemoryPointerPushLine;
}

function createPointerMemoryItem(
	overrides: Partial<ResolvedMemoryDeclaration> & Pick<ResolvedMemoryDeclaration, 'id' | 'byteAddress'>
) {
	return {
		numberOfElements: 1,
		elementWordSize: 4,
		allocationUnitAddress: 0,
		allocationUnitCount: 1,
		isInteger: true,
		isUnsigned: false,
		pointerDepth: 1,
		type: 'int*',
		lineNumber: 1,
		...overrides,
	} as ResolvedMemoryDeclaration;
}

describe('pushMemoryPointer', () => {
	it('dereferences double pointers once and returns the inner pointer value', () => {
		const context = createInstructionCompilerTestContext();
		const ptr = createPointerMemoryItem({
			id: 'ptr',
			byteAddress: 12,
			isInteger: false,
			pointeeBaseType: 'float64',
			pointerDepth: 2,
			type: 'float64**',
		});

		pushMemoryPointer(createResolvedMemoryPointerPushLine('ptr', ptr), context);

		expect(context.byteCode).toEqual([...i32const(12), ...i32load(), ...i32load()]);
	});

	it('dereferences double pointers twice and loads target kind', () => {
		const context = createInstructionCompilerTestContext();
		const ptr = createPointerMemoryItem({
			id: 'ptr',
			byteAddress: 12,
			isInteger: false,
			pointeeBaseType: 'float64',
			pointerDepth: 2,
			type: 'float64**',
		});

		pushMemoryPointer(createResolvedMemoryPointerPushLine('ptr', ptr, 2), context);

		expect(context.byteCode).toEqual([...i32const(12), ...i32load(), ...i32load(), ...f64load()]);
	});

	it('dereferences int8* with i32load8s for the final load', () => {
		const context = createInstructionCompilerTestContext();
		const ptr = createPointerMemoryItem({
			id: 'ptr',
			byteAddress: 8,
			pointeeBaseType: 'int8',
			pointerDepth: 1,
			type: 'int8*',
		});

		pushMemoryPointer(createResolvedMemoryPointerPushLine('ptr', ptr), context);

		expect(context.byteCode).toEqual([...i32const(8), ...i32load(), ...i32load8s()]);
	});

	it('dereferences int8u* with i32load8u for the final load', () => {
		const context = createInstructionCompilerTestContext();
		const ptr = createPointerMemoryItem({
			id: 'ptr',
			byteAddress: 8,
			pointeeBaseType: 'int8u',
			pointerDepth: 1,
			type: 'int8*',
		});

		pushMemoryPointer(createResolvedMemoryPointerPushLine('ptr', ptr), context);

		expect(context.byteCode).toEqual([...i32const(8), ...i32load(), ...i32load8u()]);
	});

	it('dereferences int8** once without the final load', () => {
		const context = createInstructionCompilerTestContext();
		const pptr = createPointerMemoryItem({
			id: 'pptr',
			byteAddress: 4,
			pointeeBaseType: 'int8',
			pointerDepth: 2,
			type: 'int8**',
		});

		pushMemoryPointer(createResolvedMemoryPointerPushLine('pptr', pptr), context);

		expect(context.byteCode).toEqual([...i32const(4), ...i32load(), ...i32load()]);
	});

	it('dereferences int16* with i32load16s for the final load', () => {
		const context = createInstructionCompilerTestContext();
		const ptr = createPointerMemoryItem({
			id: 'ptr',
			byteAddress: 8,
			pointeeBaseType: 'int16',
			pointerDepth: 1,
			type: 'int16*',
		});

		pushMemoryPointer(createResolvedMemoryPointerPushLine('ptr', ptr), context);

		expect(context.byteCode).toEqual([...i32const(8), ...i32load(), ...i32load16s()]);
	});

	it('dereferences int16u* with i32load16u for the final load', () => {
		const context = createInstructionCompilerTestContext();
		const ptr = createPointerMemoryItem({
			id: 'ptr',
			byteAddress: 8,
			pointeeBaseType: 'int16u',
			pointerDepth: 1,
			type: 'int16*',
		});

		pushMemoryPointer(createResolvedMemoryPointerPushLine('ptr', ptr), context);

		expect(context.byteCode).toEqual([...i32const(8), ...i32load(), ...i32load16u()]);
	});

	it('dereferences int16** twice with i32load16s for the final load', () => {
		const context = createInstructionCompilerTestContext();
		const pptr = createPointerMemoryItem({
			id: 'pptr',
			byteAddress: 4,
			pointeeBaseType: 'int16',
			pointerDepth: 2,
			type: 'int16**',
		});

		pushMemoryPointer(createResolvedMemoryPointerPushLine('pptr', pptr, 2), context);

		expect(context.byteCode).toEqual([...i32const(4), ...i32load(), ...i32load(), ...i32load16s()]);
	});
	it('pushes the stored pointer address for &*ptr without loading the pointee', () => {
		const context = createInstructionCompilerTestContext();
		const ptr = createPointerMemoryItem({
			id: 'ptr',
			byteAddress: 12,
			pointeeBaseType: 'int',
			pointerDepth: 1,
			type: 'int*',
		});
		const line = createResolvedMemoryPointerPushLine('ptr', ptr, 0);
		line.arguments = [classifyIdentifier('&*ptr')];

		pushMemoryPointer(line, context);

		expect(context.byteCode).toEqual([...i32const(12), ...i32load()]);
	});
});
