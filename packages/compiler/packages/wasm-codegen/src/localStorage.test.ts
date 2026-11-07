import type { CodegenContext } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { allocateLocal, allocateLocalFromType, allocateTemporaryLocal } from './localStorage';

function createLocalContext(): Pick<CodegenContext, 'locals' | 'allocatedLocals' | 'nextLocalIndex'> {
	return { locals: {}, allocatedLocals: [], nextLocalIndex: 0 };
}

describe('WebAssembly local storage', () => {
	it('allocates source bindings and anonymous temporaries through the same counter', () => {
		const context = createLocalContext();

		const first = allocateLocal(context, '10', { isInteger: false });
		const temporary = allocateTemporaryLocal(context, { isInteger: false, isFloat64: true });
		const second = allocateLocal(context, '2', { isInteger: true });

		expect(first.index).toBe(0);
		expect(temporary.index).toBe(1);
		expect(second.index).toBe(2);
		expect(context.locals).toEqual({ '10': first, '2': second });
		expect(context.allocatedLocals).toEqual([first, temporary, second]);
		expect(context.nextLocalIndex).toBe(3);
	});

	it('allocates language value types with their binding metadata', () => {
		const context = createLocalContext();

		const integer = allocateLocalFromType(context, 'integer', 'int');
		const float64Pointer = allocateLocalFromType(context, 'pointer', 'float64*');

		expect(integer).toEqual({ isInteger: true, index: 0 });
		expect(float64Pointer).toEqual({
			isInteger: true,
			pointeeBaseType: 'float64',
			pointerDepth: 1,
			index: 1,
		});
		expect(context.allocatedLocals).toEqual([integer, float64Pointer]);
	});

	it('retains every allocation independently of source lookup replacement', () => {
		const context = createLocalContext();
		const original = allocateLocal(context, 'binding', { isInteger: true });
		const replacement = allocateLocal(context, 'binding', { isInteger: false });
		const temporary = allocateTemporaryLocal(context, { isInteger: false, isFloat64: true });

		expect(context.locals.binding).toBe(replacement);
		expect(context.allocatedLocals).toEqual([original, replacement, temporary]);
		expect(temporary.index).toBe(2);
		expect(context.nextLocalIndex).toBe(3);
	});
});
