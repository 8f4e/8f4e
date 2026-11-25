import { describe, expect, it } from 'vitest';
import { isArrayMemoryDeclarationInstructionName, isMemoryDeclarationInstructionName } from './memory';

describe('memory instruction classifiers', () => {
	it('identifies scalar and array memory declaration instructions', () => {
		expect(isMemoryDeclarationInstructionName('int')).toBe(true);
		expect(isMemoryDeclarationInstructionName('float64**')).toBe(true);
		expect(isMemoryDeclarationInstructionName('int[]')).toBe(true);
		expect(isMemoryDeclarationInstructionName('float64*[]')).toBe(true);
		expect(isMemoryDeclarationInstructionName('push')).toBe(false);
	});

	it('identifies array memory declaration instructions', () => {
		expect(isArrayMemoryDeclarationInstructionName('int[]')).toBe(true);
		expect(isArrayMemoryDeclarationInstructionName('int*[]')).toBe(true);
		expect(isArrayMemoryDeclarationInstructionName('float64**[]')).toBe(true);
		expect(isArrayMemoryDeclarationInstructionName('int')).toBe(false);
		expect(isArrayMemoryDeclarationInstructionName('bool[]')).toBe(false);
	});
});
