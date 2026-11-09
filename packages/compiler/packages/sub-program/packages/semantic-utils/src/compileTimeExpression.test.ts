import type { ArgumentCompileTimeExpression, CompileTimeOperand, Const } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { resolveCompileTimeExpression } from './compileTimeExpression';

function literal(value: number): CompileTimeOperand {
	return { type: ArgumentType.LITERAL, value, isInteger: Number.isInteger(value) };
}

function resolveLiteral(operand: CompileTimeOperand): Const | undefined {
	return operand.type === ArgumentType.LITERAL
		? { value: operand.value, isInteger: operand.isInteger, ...(operand.isFloat64 ? { isFloat64: true } : {}) }
		: undefined;
}

function expression(source: Omit<ArgumentCompileTimeExpression, 'type'>): ArgumentCompileTimeExpression {
	return { type: ArgumentType.COMPILE_TIME_EXPRESSION, ...source } as ArgumentCompileTimeExpression;
}

describe('resolveCompileTimeExpression', () => {
	it.each([
		['round', 1.5, 2],
		['round', -1.5, -2],
		['floor', 1.9, 1],
		['ceil', 1.1, 2],
	] as const)('applies %s to a resolved operand', (rounding, value, expected) => {
		expect(resolveCompileTimeExpression(expression({ left: literal(value), rounding }), resolveLiteral)).toEqual({
			value: expected,
			isInteger: true,
		});
	});

	it('evaluates and rounds a binary expression once', () => {
		expect(
			resolveCompileTimeExpression(
				expression({ left: literal(5), operator: '/', right: literal(2), rounding: 'floor' }),
				resolveLiteral
			)
		).toEqual({ value: 2, isInteger: true });
	});

	it('returns undefined when an operand cannot be resolved or division uses zero', () => {
		const identifier: CompileTimeOperand = {
			type: ArgumentType.IDENTIFIER,
			value: 'MISSING',
			referenceKind: 'constant',
			scope: 'local',
		};

		expect(
			resolveCompileTimeExpression(expression({ left: identifier, rounding: 'round' }), resolveLiteral)
		).toBeUndefined();
		expect(
			resolveCompileTimeExpression(expression({ left: literal(1), operator: '/', right: literal(0) }), resolveLiteral)
		).toBeUndefined();
	});

	it('preserves valid address arithmetic metadata until an explicit rounding conversion', () => {
		const address: CompileTimeOperand = {
			type: ArgumentType.IDENTIFIER,
			value: '&buffer',
			referenceKind: 'memory-reference',
			scope: 'local',
			targetMemoryId: 'buffer',
		};
		const resolveAddress = (operand: CompileTimeOperand): Const | undefined =>
			operand === address
				? {
						value: 16,
						isInteger: true,
						address: {
							safeRange: {
								source: 'memory-start',
								byteAddress: 16,
								safeByteLength: 16,
								memoryId: 0,
							},
						},
					}
				: resolveLiteral(operand);

		expect(
			resolveCompileTimeExpression(expression({ left: address, operator: '+', right: literal(4) }), resolveAddress)
		).toEqual({
			value: 20,
			isInteger: true,
			address: {
				safeRange: {
					source: 'memory-start',
					byteAddress: 20,
					safeByteLength: 12,
					memoryId: 0,
				},
			},
		});
		expect(
			resolveCompileTimeExpression(
				expression({ left: address, operator: '+', right: literal(4), rounding: 'round' }),
				resolveAddress
			)
		).toEqual({ value: 20, isInteger: true });
	});
});
