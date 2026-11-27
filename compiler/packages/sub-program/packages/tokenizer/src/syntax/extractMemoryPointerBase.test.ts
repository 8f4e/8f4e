import { describe, expect, it } from 'vitest';

import extractMemoryPointerBase from './extractMemoryPointerBase';

describe('extractMemoryPointerBase', () => {
	it('removes pointer prefix', () => {
		expect(extractMemoryPointerBase('*value')).toBe('value');
	});

	it('removes double-dereference pointer prefix', () => {
		expect(extractMemoryPointerBase('**value')).toBe('value');
	});

	it('leaves plain identifiers unchanged', () => {
		expect(extractMemoryPointerBase('value')).toBe('value');
	});
});
