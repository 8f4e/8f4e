import { describe, expect, it } from 'vitest';

import parseLiteralMulDivExpression from './parseLiteralMulDivExpression';

describe('parseLiteralMulDivExpression', () => {
	it('folds integer multiplication', () => {
		expect(parseLiteralMulDivExpression('16*2')).toEqual({
			value: 32,
			isInteger: true,
		});
		expect(parseLiteralMulDivExpression('3*4')).toEqual({
			value: 12,
			isInteger: true,
		});
	});

	it('folds float * integer: result is float-typed even when mathematically integer', () => {
		expect(parseLiteralMulDivExpression('3.5*4')).toEqual({
			value: 14,
			isInteger: false,
		});
	});

	it('folds float * float with float result', () => {
		expect(parseLiteralMulDivExpression('3.5*0.5')).toEqual({
			value: 1.75,
			isInteger: false,
		});
	});

	it('folds integer division', () => {
		expect(parseLiteralMulDivExpression('8/2')).toEqual({
			value: 4,
			isInteger: true,
		});
	});

	it('folds integer division with float result', () => {
		expect(parseLiteralMulDivExpression('1/2')).toEqual({
			value: 0.5,
			isInteger: false,
		});
	});

	it('folds hex operands', () => {
		expect(parseLiteralMulDivExpression('0x10/2')).toEqual({
			value: 8,
			isInteger: true,
		});
		expect(parseLiteralMulDivExpression('0x10*2')).toEqual({
			value: 32,
			isInteger: true,
		});
	});

	it('folds binary operands', () => {
		expect(parseLiteralMulDivExpression('0b101*2')).toEqual({
			value: 10,
			isInteger: true,
		});
		expect(parseLiteralMulDivExpression('0b1000/2')).toEqual({
			value: 4,
			isInteger: true,
		});
	});

	it('propagates isFloat64 from lhs operand', () => {
		expect(parseLiteralMulDivExpression('3f64*2')).toEqual({
			value: 6,
			isInteger: false,
			isFloat64: true,
		});
	});

	it('propagates isFloat64 from rhs operand', () => {
		expect(parseLiteralMulDivExpression('2*3f64')).toEqual({
			value: 6,
			isInteger: false,
			isFloat64: true,
		});
	});

	it('propagates isFloat64 when both operands are f64', () => {
		expect(parseLiteralMulDivExpression('3f64*2f64')).toEqual({
			value: 6,
			isInteger: false,
			isFloat64: true,
		});
	});

	it('throws for invalid numeric operands', () => {
		expect(() => parseLiteralMulDivExpression('1e309*2')).toThrow('Invalid numeric literal');
		expect(() => parseLiteralMulDivExpression('1e309f64*2')).toThrow('Invalid numeric literal');
		expect(() => parseLiteralMulDivExpression('2*1e309f64')).toThrow('Invalid numeric literal');
	});

	it('throws on division by zero', () => {
		expect(() => parseLiteralMulDivExpression('8/0')).toThrow('Division by zero');
		expect(() => parseLiteralMulDivExpression('1/0')).toThrow('Division by zero');
	});

	it('returns null for chained operators', () => {
		expect(parseLiteralMulDivExpression('2*3*4')).toBeNull();
		expect(parseLiteralMulDivExpression('2*3/4')).toBeNull();
	});

	it('returns null for identifier operands', () => {
		expect(parseLiteralMulDivExpression('SIZE*2')).toBeNull();
		expect(parseLiteralMulDivExpression('SIZE/2')).toBeNull();
	});

	it('returns null for plain numeric literals', () => {
		expect(parseLiteralMulDivExpression('16')).toBeNull();
		expect(parseLiteralMulDivExpression('3.14')).toBeNull();
		expect(parseLiteralMulDivExpression('0x10')).toBeNull();
	});

	it('folds negative numerator with positive denominator', () => {
		expect(parseLiteralMulDivExpression('-1/2')).toEqual({
			value: -0.5,
			isInteger: false,
		});
	});

	it('folds positive numerator with negative denominator', () => {
		expect(parseLiteralMulDivExpression('1/-2')).toEqual({
			value: -0.5,
			isInteger: false,
		});
	});

	it('folds integer exponentiation', () => {
		expect(parseLiteralMulDivExpression('2^16')).toEqual({
			value: 65536,
			isInteger: true,
		});
		expect(parseLiteralMulDivExpression('3^3')).toEqual({
			value: 27,
			isInteger: true,
		});
	});

	it('folds hex operands in exponentiation', () => {
		expect(parseLiteralMulDivExpression('0x10^2')).toEqual({
			value: 256,
			isInteger: true,
		});
	});

	it('folds float exponent: result is float-typed', () => {
		expect(parseLiteralMulDivExpression('2^0.5')).toEqual({
			value: Math.sqrt(2),
			isInteger: false,
		});
	});

	it('folds negative exponent: result is float-typed', () => {
		expect(parseLiteralMulDivExpression('2^-1')).toEqual({
			value: 0.5,
			isInteger: false,
		});
	});

	it('propagates isFloat64 from lhs operand in exponentiation', () => {
		expect(parseLiteralMulDivExpression('2f64^2')).toEqual({
			value: 4,
			isInteger: false,
			isFloat64: true,
		});
	});

	it('propagates isFloat64 from rhs operand in exponentiation', () => {
		expect(parseLiteralMulDivExpression('2^2f64')).toEqual({
			value: 4,
			isInteger: false,
			isFloat64: true,
		});
	});

	it('returns null for chained exponentiation', () => {
		expect(parseLiteralMulDivExpression('2^3^4')).toBeNull();
	});

	it('returns null for mixed exponentiation and other operators', () => {
		expect(parseLiteralMulDivExpression('2^3*4')).toBeNull();
		expect(parseLiteralMulDivExpression('4*2^3')).toBeNull();
	});
});
