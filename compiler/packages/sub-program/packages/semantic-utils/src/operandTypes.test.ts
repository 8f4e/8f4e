import type { StackItem } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { areAllOperandsFloat64, areAllOperandsIntegers } from './operandTypes';

describe('operandTypes utilities', () => {
	const intOperand: StackItem = { kind: 'value', valueType: 'int', isNonZero: false };
	const floatOperand: StackItem = { kind: 'value', valueType: 'float', isNonZero: false };
	const float64Operand: StackItem = { kind: 'value', valueType: 'float64', isNonZero: false };

	describe('areAllOperandsIntegers', () => {
		it('returns true when all operands are integers', () => {
			expect(areAllOperandsIntegers(intOperand, intOperand)).toBe(true);
			expect(areAllOperandsIntegers(intOperand)).toBe(true);
		});

		it('returns false when at least one operand is float', () => {
			expect(areAllOperandsIntegers(intOperand, floatOperand)).toBe(false);
			expect(areAllOperandsIntegers(floatOperand)).toBe(false);
		});

		it('returns true for empty operands', () => {
			expect(areAllOperandsIntegers()).toBe(true);
		});
	});

	describe('areAllOperandsFloat64', () => {
		it('returns true when all operands are float64', () => {
			expect(areAllOperandsFloat64(float64Operand, float64Operand)).toBe(true);
			expect(areAllOperandsFloat64(float64Operand)).toBe(true);
		});

		it('returns false when operands are float32', () => {
			expect(areAllOperandsFloat64(floatOperand, floatOperand)).toBe(false);
			expect(areAllOperandsFloat64(floatOperand)).toBe(false);
		});

		it('returns false when operands are mixed float32/float64', () => {
			expect(areAllOperandsFloat64(floatOperand, float64Operand)).toBe(false);
		});

		it('returns false when operands are integers', () => {
			expect(areAllOperandsFloat64(intOperand)).toBe(false);
		});

		it('returns false for empty operands', () => {
			expect(areAllOperandsFloat64()).toBe(false);
		});
	});
});
