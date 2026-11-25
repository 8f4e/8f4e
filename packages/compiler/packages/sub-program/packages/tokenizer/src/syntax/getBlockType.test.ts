import { describe, expect, it } from 'vitest';

import { getBlockType, isCompilableBlockType } from './getBlockType';

describe('getBlockType', () => {
	it('detects module blocks', () => {
		expect(getBlockType(['module foo', 'moduleEnd'])).toBe('module');
	});

	it('detects function blocks', () => {
		expect(getBlockType(['function foo', 'functionEnd'])).toBe('function');
	});

	it('detects constants blocks', () => {
		expect(getBlockType(['constants', 'constantsEnd'])).toBe('constants');
	});

	it('returns unknown for blocks without proper markers', () => {
		expect(getBlockType(['int x 5', 'add'])).toBe('unknown');
		expect(getBlockType(['includes', 'include std/events/risingEdge', 'includesEnd'])).toBe('unknown');
	});

	it('returns unknown for mixed markers', () => {
		expect(getBlockType(['module foo', 'functionEnd', 'moduleEnd'])).toBe('unknown');
	});

	it('handles whitespace in block markers', () => {
		expect(getBlockType(['  constants   math  ', 'const PI 3.14159', '  constantsEnd  '])).toBe('constants');
	});
});

describe('isCompilableBlockType', () => {
	it('returns true for compilable block types', () => {
		expect(isCompilableBlockType('module')).toBe(true);
		expect(isCompilableBlockType('function')).toBe(true);
		expect(isCompilableBlockType('constants')).toBe(true);
	});

	it('returns false for non-compilable block types', () => {
		expect(isCompilableBlockType('unknown')).toBe(false);
		expect(isCompilableBlockType('note')).toBe(false);
		expect(isCompilableBlockType('includes')).toBe(false);
		expect(isCompilableBlockType(undefined)).toBe(false);
	});
});
