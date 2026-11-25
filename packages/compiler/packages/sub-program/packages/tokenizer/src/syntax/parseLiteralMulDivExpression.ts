import parseNumericLiteralToken, { isNumericLikeInvalidToken } from './parseNumericLiteralToken';
import { SyntaxErrorCode, SyntaxIssue } from './syntaxError';

export type LiteralMulDivResult = {
	value: number;
	isInteger: boolean;
	isFloat64?: boolean;
};

/**
 * Tries to parse a literal-only `*`, `/`, or `^` expression with exactly one operator
 * and numeric-literal operands on both sides.
 *
 * Returns the folded result, or `null` if the argument is not a literal arithmetic expression.
 * Throws `SyntaxIssue` when a literal-only numeric expression contains an invalid
 * numeric operand or divides by zero.
 *
 * @param argument - Parsed argument to process.
 * @returns Parsed literal mul div expression.
 */
export default function parseLiteralMulDivExpression(argument: string): LiteralMulDivResult | null {
	// Require exactly one *, /, or ^ across the whole string
	const operators = argument.match(/[*/^]/g);
	if (!operators || operators.length !== 1) {
		return null;
	}

	const opIndex = argument.indexOf(operators[0]);
	// Operator must not be at the start or end
	if (opIndex <= 0 || opIndex === argument.length - 1) {
		return null;
	}

	const operator = argument[opIndex] as '*' | '/' | '^';
	const lhsStr = argument.slice(0, opIndex);
	const rhsStr = argument.slice(opIndex + 1);

	let lhs: ReturnType<typeof parseNumericLiteralToken>;
	let rhs: ReturnType<typeof parseNumericLiteralToken>;

	try {
		lhs = parseNumericLiteralToken(lhsStr);
		rhs = parseNumericLiteralToken(rhsStr);
	} catch (error) {
		if (error instanceof SyntaxIssue && error.code === SyntaxErrorCode.INVALID_NUMERIC_LITERAL) {
			throw new SyntaxIssue(
				SyntaxErrorCode.INVALID_NUMERIC_LITERAL,
				`Invalid numeric literal or expression: ${argument}`
			);
		}
		throw error;
	}

	if (!lhs || !rhs) {
		if ((!lhs && isNumericLikeInvalidToken(lhsStr)) || (!rhs && isNumericLikeInvalidToken(rhsStr))) {
			throw new SyntaxIssue(
				SyntaxErrorCode.INVALID_NUMERIC_LITERAL,
				`Invalid numeric literal or expression: ${argument}`
			);
		}
		return null;
	}

	if (operator === '/' && rhs.value === 0) {
		throw new SyntaxIssue(SyntaxErrorCode.DIVISION_BY_ZERO, `Division by zero in literal expression: ${argument}`);
	}

	const value =
		operator === '*' ? lhs.value * rhs.value : operator === '/' ? lhs.value / rhs.value : lhs.value ** rhs.value;
	const isFloat64 = lhs.isFloat64 || rhs.isFloat64;

	return {
		value,
		isInteger: !isFloat64 && lhs.isInteger && rhs.isInteger && Number.isInteger(value),
		...(isFloat64 && { isFloat64: true }),
	};
}
