import type { Argument, ArgumentCompileTimeExpression, CompileTimeRoundingValue } from '@8f4e/language-spec';
import { ArgumentType, CompileTimeRounding } from '@8f4e/language-spec';
import parseConstantMulDivExpression, { findOperatorOutsideParens } from '../parseConstantMulDivExpression';
import parseLiteralMulDivExpression from '../parseLiteralMulDivExpression';
import parseNumericLiteralToken, {
	isNumericLikeInvalidToken,
	startsWithNumericPrefix,
} from '../parseNumericLiteralToken';
import { SyntaxErrorCode, SyntaxRulesError } from '../syntaxError';
import { classifyIdentifier } from './classifyIdentifier';
import { decodeStringLiteral } from './decodeStringLiteral';
import { parseCompileTimeOperand } from './parseCompileTimeOperand';

export { classifyIdentifier } from './classifyIdentifier';
export { decodeStringLiteral } from './decodeStringLiteral';
export { parseCompileTimeOperand } from './parseCompileTimeOperand';

const ROUNDING_NAMES = new Set<string>(Object.values(CompileTimeRounding));

function hasBalancedParentheses(value: string): boolean {
	let depth = 0;
	for (const character of value) {
		if (character === '(') {
			depth++;
		} else if (character === ')') {
			depth--;
			if (depth < 0) {
				return false;
			}
		}
	}
	return depth === 0;
}

function parseCompileTimeRoundingExpression(argument: string): ArgumentCompileTimeExpression | null {
	const openParenIndex = argument.indexOf('(');
	if (openParenIndex < 0 || !ROUNDING_NAMES.has(argument.slice(0, openParenIndex))) {
		return null;
	}

	const rounding = argument.slice(0, openParenIndex) as CompileTimeRoundingValue;
	if (!argument.endsWith(')')) {
		throw new SyntaxRulesError(
			SyntaxErrorCode.INVALID_NUMERIC_LITERAL,
			`Invalid compile-time rounding expression: ${argument}`
		);
	}

	const operandSource = argument.slice(openParenIndex + 1, -1);
	const operatorIndex = findOperatorOutsideParens(operandSource);
	if (
		operandSource.length === 0 ||
		!hasBalancedParentheses(operandSource) ||
		operatorIndex === -2 ||
		operatorIndex === 0 ||
		operatorIndex === operandSource.length - 1
	) {
		throw new SyntaxRulesError(
			SyntaxErrorCode.INVALID_NUMERIC_LITERAL,
			`Invalid compile-time rounding expression: ${argument}`
		);
	}

	const operand = parseArgument(operandSource);
	if (operand.type === ArgumentType.STRING_LITERAL || operand.type === ArgumentType.COMPILE_TIME_EXPRESSION) {
		if (operand.type !== ArgumentType.COMPILE_TIME_EXPRESSION || operand.rounding !== undefined) {
			throw new SyntaxRulesError(
				SyntaxErrorCode.INVALID_NUMERIC_LITERAL,
				`Invalid compile-time rounding expression: ${argument}`
			);
		}
		return { ...operand, rounding };
	}

	return {
		type: ArgumentType.COMPILE_TIME_EXPRESSION,
		left: operand,
		rounding,
	};
}

/**
 * Parses a single argument from an instruction line.
 * Recognizes numeric literals, quoted string literals, compile-time expressions, and identifiers.
 *
 * @param argument - The argument string to parse.
 * @returns Parsed argument with type information.
 */
export function parseArgument(argument: string): Argument {
	// Quoted strings must be recognized before arithmetic parsing, because operators
	// inside a string are content rather than numeric-expression syntax.
	if (argument.startsWith('"') && argument.endsWith('"') && argument.length >= 2) {
		const raw = argument.slice(1, -1);
		return {
			type: ArgumentType.STRING_LITERAL,
			value: decodeStringLiteral(raw),
		};
	}

	const roundingExpression = parseCompileTimeRoundingExpression(argument);
	if (roundingExpression !== null) {
		return roundingExpression;
	}

	// Try to fold literal-only mul/div expressions (handles *, /, and integer/integer fractions)
	const mulDivResult = parseLiteralMulDivExpression(argument);
	if (mulDivResult !== null) {
		return {
			type: ArgumentType.LITERAL,
			value: mulDivResult.value,
			isInteger: mulDivResult.isInteger,
			...(mulDivResult.isFloat64 && { isFloat64: true }),
		};
	}

	switch (true) {
		default: {
			const numericLiteral = parseNumericLiteralToken(argument);
			if (numericLiteral) {
				return {
					value: numericLiteral.value,
					type: ArgumentType.LITERAL,
					isInteger: numericLiteral.isInteger,
					...(numericLiteral.isFloat64 && { isFloat64: true }),
					...(numericLiteral.isHex && { isHex: true }),
				};
			}

			const compileTimeExpression = parseConstantMulDivExpression(argument);
			if (compileTimeExpression !== null) {
				const left = parseCompileTimeOperand(compileTimeExpression.lhs);
				const right = parseCompileTimeOperand(compileTimeExpression.rhs);
				return {
					type: ArgumentType.COMPILE_TIME_EXPRESSION,
					left,
					operator: compileTimeExpression.operator,
					right,
				};
			}

			// Reject numeric-looking tokens that failed literal parsing so they do not silently
			// become identifiers. This keeps standalone and compound numeric syntax boundaries clear.
			if (isNumericLikeInvalidToken(argument)) {
				throw new SyntaxRulesError(
					SyntaxErrorCode.INVALID_NUMERIC_LITERAL,
					`Invalid numeric literal or expression: ${argument}`
				);
			}
			if (startsWithNumericPrefix(argument)) {
				throw new SyntaxRulesError(
					SyntaxErrorCode.INVALID_IDENTIFIER,
					`Identifiers cannot start with numbers: ${argument}`
				);
			}
			return classifyIdentifier(argument);
		}
	}
}
