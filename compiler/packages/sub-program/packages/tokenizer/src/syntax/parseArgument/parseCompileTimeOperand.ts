import type { ArgumentIdentifier, ArgumentLiteral } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import parseNumericLiteralToken from '../parseNumericLiteralToken';
import { classifyIdentifier } from './classifyIdentifier';

/**
 * Parses a single compile-time expression operand (left-hand or right-hand side).
 * Operands can be numeric literals or identifier-shaped tokens; they are never
 * themselves expressions because the grammar only allows a single operator.
 *
 * @param operand - Raw operand token from a compile-time expression.
 * @returns Parsed literal or identifier operand.
 */
export function parseCompileTimeOperand(operand: string): ArgumentLiteral | ArgumentIdentifier {
	const numericLiteral = parseNumericLiteralToken(operand);
	if (numericLiteral) {
		return {
			value: numericLiteral.value,
			type: ArgumentType.LITERAL,
			isInteger: numericLiteral.isInteger,
			...(numericLiteral.isFloat64 && { isFloat64: true }),
			...(numericLiteral.isHex && { isHex: true }),
		};
	}
	return classifyIdentifier(operand);
}
