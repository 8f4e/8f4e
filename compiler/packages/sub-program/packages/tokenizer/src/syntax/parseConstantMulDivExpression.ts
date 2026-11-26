export type CompileTimeMulDivExpression = {
	lhs: string;
	operator: '+' | '-' | '*' | '/' | '^';
	rhs: string;
};

/**
 * Finds the index of the single `+`, `-`, `*`, `/`, or `^` operator that appears outside of parentheses.
 * Returns -1 if there is no such operator, or -2 if there is more than one.
 */
export function findOperatorOutsideParens(value: string): number {
	let depth = 0;
	let operatorIndex = -1;

	for (let i = 0; i < value.length; i++) {
		const ch = value[i];
		if (ch === '(') {
			depth++;
		} else if (ch === ')') {
			depth--;
		} else if ((ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') && depth === 0) {
			// Check from the start of the operand so VALUE-1 and 0x1E-1 stay subtraction.
			const isExponentSign =
				(value[i - 1] === 'e' || value[i - 1] === 'E') &&
				/^-?(?:\d+\.?\d*|\.\d+)[eE][+-]\d$/.test(value.slice(operatorIndex + 1, i + 2));

			// Skip operand signs: -1/FOO, FOO/-1, FOO--1, FOO*1e-3.
			if (
				(ch === '+' || ch === '-') &&
				(i === 0 ||
					value[i - 1] === '+' ||
					value[i - 1] === '-' ||
					value[i - 1] === '*' ||
					value[i - 1] === '/' ||
					value[i - 1] === '^' ||
					isExponentSign)
			) {
				continue;
			}
			if (operatorIndex !== -1) {
				return -2; // More than one operator outside parens
			}
			operatorIndex = i;
		}
	}

	return operatorIndex;
}

/**
 * Parses a compile-time `+`, `-`, `*`, `/`, or `^` expression with exactly one operator outside parentheses.
 * Each side can be any compile-time-resolvable operand: a numeric literal,
 * a constant identifier, or a metadata query such as `sizeof(name)` or `count(name)`.
 *
 * Returns the parsed expression or `null` if the value is not a single-operator expression.
 *
 * @param value - Value to inspect.
 * @returns Parsed constant mul div expression.
 */
export default function parseConstantMulDivExpression(value: string): CompileTimeMulDivExpression | null {
	const operatorIndex = findOperatorOutsideParens(value);

	// Require exactly one operator outside parens
	if (operatorIndex < 0) {
		return null;
	}

	// Operator must not be at start or end
	if (operatorIndex === 0 || operatorIndex === value.length - 1) {
		return null;
	}

	const operator = value[operatorIndex] as CompileTimeMulDivExpression['operator'];
	const lhs = value.slice(0, operatorIndex);
	const rhs = value.slice(operatorIndex + 1);

	return { lhs, operator, rhs };
}
