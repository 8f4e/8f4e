import type { LocalStorageMap } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { allocateLocal, allocateLocalFromType, allocateTemporaryLocal } from './localStorage';

function createLocalContext(overrides: { locals?: LocalStorageMap; nextLocalIndex?: number } = {}) {
	return { locals: {}, nextLocalIndex: 0, ...overrides };
}

describe('WebAssembly local storage', () => {
	it('allocates bindings in order and registers them by name', () => {
		const context = createLocalContext();

		const first = allocateLocal(context, 'first', { isInteger: true });
		const second = allocateLocal(context, 'second', { isInteger: false, isFloat64: true });

		expect(first.index).toBe(0);
		expect(second.index).toBe(1);
		expect(context.locals).toEqual({ first, second });
		expect(context.nextLocalIndex).toBe(2);
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
	});

	it('continues from an explicitly seeded backend index', () => {
		const context = createLocalContext({
			nextLocalIndex: 6,
			locals: {
				first: { isInteger: true, index: 1 },
				last: { isInteger: false, index: 5 },
			},
		});

		const local = allocateLocal(context, 'next', { isInteger: true });

		expect(local.index).toBe(6);
		expect(context.nextLocalIndex).toBe(7);
	});

	it('retains distinct temporary declarations and types after source bindings', () => {
		const context = createLocalContext();
		const source = allocateLocalFromType(context, '0', 'int');
		const integer = allocateTemporaryLocal(context, { isInteger: true });
		const float = allocateTemporaryLocal(context, { isInteger: false });
		const double = allocateTemporaryLocal(context, { isInteger: false, isFloat64: true });

		expect(Object.values(context.locals)).toEqual([source, integer, float, double]);
		expect(Object.values(context.locals).map(local => local.index)).toEqual([0, 1, 2, 3]);
		expect(context.nextLocalIndex).toBe(4);
	});
});
