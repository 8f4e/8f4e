import { describe, expect, it } from 'vitest';

import parseConstantMulDivExpression from './parseConstantMulDivExpression';

describe('parseConstantMulDivExpression', () => {
	it.each([
		['SCALE*1e-3', 'SCALE', '*', '1e-3'],
		['1e-3*SCALE', '1e-3', '*', 'SCALE'],
		['SCALE/1E+3', 'SCALE', '/', '1E+3'],
		['1E+3/SCALE', '1E+3', '/', 'SCALE'],
		['SCALE+1e+3', 'SCALE', '+', '1e+3'],
		['1e+3+SCALE', '1e+3', '+', 'SCALE'],
		['SCALE-1E-3', 'SCALE', '-', '1E-3'],
		['1E-3-SCALE', '1E-3', '-', 'SCALE'],
		['SCALE^1e-3f64', 'SCALE', '^', '1e-3f64'],
		['1e-3f64^SCALE', '1e-3f64', '^', 'SCALE'],
		['-2.5e-2*1E+3f64', '-2.5e-2', '*', '1E+3f64'],
		['SCALE*-1e-3', 'SCALE', '*', '-1e-3'],
		['-.5E-3f64/SCALE', '-.5E-3f64', '/', 'SCALE'],
		['SCALE*.5E+3f64', 'SCALE', '*', '.5E+3f64'],
		['SCALE*1.E-3', 'SCALE', '*', '1.E-3'],
		['sizeof(*ptr)*1e-3', 'sizeof(*ptr)', '*', '1e-3'],
	])('parses exponent signs in %s', (source, lhs, operator, rhs) => {
		expect(parseConstantMulDivExpression(source)).toEqual({ lhs, operator, rhs });
	});

	it.each(['1e-3', '1E+3', '-.5e-3f64', '-1.E+3'])(
		'does not treat the exponent sign in %s as an expression operator',
		source => {
			expect(parseConstantMulDivExpression(source)).toBeNull();
		}
	);

	it.each(['VALUE', 'VALUE1E', 'value', '0x1E'])('preserves subtraction after %s', lhs => {
		expect(parseConstantMulDivExpression(`${lhs}-1`)).toEqual({ lhs, operator: '-', rhs: '1' });
	});

	it.each(['SCALE*1e-3/2', '1e-3*SCALE+1', '1e+3^2+1', 'SCALE*1e-3+1e-4'])(
		'rejects actual chained operators in %s',
		source => {
			expect(parseConstantMulDivExpression(source)).toBeNull();
		}
	);

	it('parses constant * literal', () => {
		expect(parseConstantMulDivExpression('SIZE*2')).toEqual({
			lhs: 'SIZE',
			operator: '*',
			rhs: '2',
		});
	});

	it('parses constant / literal', () => {
		expect(parseConstantMulDivExpression('SIZE/2')).toEqual({
			lhs: 'SIZE',
			operator: '/',
			rhs: '2',
		});
	});

	it('parses literal * constant', () => {
		expect(parseConstantMulDivExpression('2*SIZE')).toEqual({
			lhs: '2',
			operator: '*',
			rhs: 'SIZE',
		});
	});

	it('parses metadata query * literal', () => {
		expect(parseConstantMulDivExpression('sizeof(name)*2')).toEqual({
			lhs: 'sizeof(name)',
			operator: '*',
			rhs: '2',
		});
	});

	it('parses literal * metadata query', () => {
		expect(parseConstantMulDivExpression('123*sizeof(name)')).toEqual({
			lhs: '123',
			operator: '*',
			rhs: 'sizeof(name)',
		});
	});

	it('parses metadata query with pointee form', () => {
		expect(parseConstantMulDivExpression('sizeof(*ptr)*4')).toEqual({
			lhs: 'sizeof(*ptr)',
			operator: '*',
			rhs: '4',
		});
	});

	it('parses constant * metadata query', () => {
		expect(parseConstantMulDivExpression('SIZE*sizeof(name)')).toEqual({
			lhs: 'SIZE',
			operator: '*',
			rhs: 'sizeof(name)',
		});
	});

	it('rejects multiple operators outside parens', () => {
		expect(parseConstantMulDivExpression('SIZE/2/2')).toBeNull();
		expect(parseConstantMulDivExpression('SIZE*2/2')).toBeNull();
	});

	it('rejects operators at start or end', () => {
		expect(parseConstantMulDivExpression('*SIZE')).toBeNull();
		expect(parseConstantMulDivExpression('SIZE*')).toBeNull();
	});

	it('returns null for plain identifiers or literals', () => {
		expect(parseConstantMulDivExpression('SIZE')).toBeNull();
		expect(parseConstantMulDivExpression('42')).toBeNull();
		expect(parseConstantMulDivExpression('sizeof(name)')).toBeNull();
	});

	it('counts operators inside parentheses as non-operators', () => {
		// sizeof(*name) has a * inside parens — should not count as operator
		expect(parseConstantMulDivExpression('sizeof(*name)')).toBeNull();
	});

	it('parses constant ^ literal', () => {
		expect(parseConstantMulDivExpression('SIZE^2')).toEqual({
			lhs: 'SIZE',
			operator: '^',
			rhs: '2',
		});
	});

	it('parses literal ^ constant', () => {
		expect(parseConstantMulDivExpression('2^SIZE')).toEqual({
			lhs: '2',
			operator: '^',
			rhs: 'SIZE',
		});
	});

	it('parses metadata query ^ literal', () => {
		expect(parseConstantMulDivExpression('sizeof(name)^2')).toEqual({
			lhs: 'sizeof(name)',
			operator: '^',
			rhs: '2',
		});
	});

	it('rejects chained exponentiation', () => {
		expect(parseConstantMulDivExpression('SIZE^2^3')).toBeNull();
		expect(parseConstantMulDivExpression('2^SIZE^3')).toBeNull();
	});

	it('rejects ^ at start or end', () => {
		expect(parseConstantMulDivExpression('^SIZE')).toBeNull();
		expect(parseConstantMulDivExpression('SIZE^')).toBeNull();
	});

	it('rejects mixed ^ and other operators', () => {
		expect(parseConstantMulDivExpression('SIZE^2*3')).toBeNull();
		expect(parseConstantMulDivExpression('2*SIZE^3')).toBeNull();
	});

	it('parses constant + literal', () => {
		expect(parseConstantMulDivExpression('SIZE+1')).toEqual({
			lhs: 'SIZE',
			operator: '+',
			rhs: '1',
		});
	});

	it('parses constant + constant', () => {
		expect(parseConstantMulDivExpression('FOO+BAR')).toEqual({
			lhs: 'FOO',
			operator: '+',
			rhs: 'BAR',
		});
	});

	it('parses constant - literal', () => {
		expect(parseConstantMulDivExpression('SIZE-1')).toEqual({
			lhs: 'SIZE',
			operator: '-',
			rhs: '1',
		});
	});

	it('parses literal + constant', () => {
		expect(parseConstantMulDivExpression('1+SIZE')).toEqual({
			lhs: '1',
			operator: '+',
			rhs: 'SIZE',
		});
	});

	it('parses literal - constant', () => {
		expect(parseConstantMulDivExpression('10-SIZE')).toEqual({
			lhs: '10',
			operator: '-',
			rhs: 'SIZE',
		});
	});

	it('parses metadata query + literal', () => {
		expect(parseConstantMulDivExpression('sizeof(name)+1')).toEqual({
			lhs: 'sizeof(name)',
			operator: '+',
			rhs: '1',
		});
	});

	it('parses metadata query - literal', () => {
		expect(parseConstantMulDivExpression('sizeof(name)-1')).toEqual({
			lhs: 'sizeof(name)',
			operator: '-',
			rhs: '1',
		});
	});

	it('parses signed literal / constant', () => {
		expect(parseConstantMulDivExpression('-1/FOO')).toEqual({
			lhs: '-1',
			operator: '/',
			rhs: 'FOO',
		});
	});

	it('parses constant / signed literal', () => {
		expect(parseConstantMulDivExpression('FOO/-1')).toEqual({
			lhs: 'FOO',
			operator: '/',
			rhs: '-1',
		});
	});

	it('rejects unary minus (operator at start)', () => {
		expect(parseConstantMulDivExpression('-SIZE')).toBeNull();
	});

	it('rejects + at end', () => {
		expect(parseConstantMulDivExpression('SIZE+')).toBeNull();
	});

	it('rejects - at end', () => {
		expect(parseConstantMulDivExpression('SIZE-')).toBeNull();
	});

	it('rejects multiple + operators', () => {
		expect(parseConstantMulDivExpression('SIZE+1+2')).toBeNull();
	});

	it('rejects mixed + and - operators', () => {
		expect(parseConstantMulDivExpression('SIZE+1-2')).toBeNull();
	});

	it('rejects mixed + and * operators', () => {
		expect(parseConstantMulDivExpression('SIZE+1*2')).toBeNull();
	});

	it('does not count * inside parentheses as a multiplication operator for + detection', () => {
		// The * inside sizeof(*ptr) is inside parens — should not count as operator; the outer + wins
		expect(parseConstantMulDivExpression('sizeof(*ptr)+1')).toEqual({
			lhs: 'sizeof(*ptr)',
			operator: '+',
			rhs: '1',
		});
	});
});
