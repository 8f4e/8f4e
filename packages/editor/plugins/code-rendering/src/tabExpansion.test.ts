import { describe, expect, it } from 'vitest';
import { expandLineColorsToCells, expandLineToCells } from './tabExpansion';

describe('tabExpansion', () => {
	it('expands characters and syntax colors to the same visual columns', () => {
		expect(expandLineToCells('a\tb', [4])).toEqual([97, 0x2192, 32, 32, 98]);
		expect(expandLineColorsToCells('a\tb', ['code', 'tab', 'code'], [4])).toEqual([
			'code',
			'tab',
			undefined,
			undefined,
			'code',
		]);
	});
	it('preserves a syntax color transition on a tab', () => {
		expect(
			expandLineColorsToCells('push\t1', [undefined, undefined, undefined, undefined, 'code', 'number'], [8])
		).toEqual([undefined, undefined, undefined, undefined, 'code', undefined, undefined, undefined, 'number']);
	});
});
