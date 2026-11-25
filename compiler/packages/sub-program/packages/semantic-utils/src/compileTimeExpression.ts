import type {
	ArgumentCompileTimeExpression,
	CompileTimeOperand,
	CompileTimeOperator,
	CompileTimeRoundingValue,
	Const,
	MemoryAddressRange,
} from '@8f4e/language-spec';
import { CompileTimeRounding, isBinaryCompileTimeExpression } from '@8f4e/language-spec';

export type CompileTimeOperandResolver = (operand: CompileTimeOperand) => Const | undefined;

function shiftSafeRange(safeRange: MemoryAddressRange, byteOffset: number): MemoryAddressRange | undefined {
	if (!Number.isInteger(byteOffset) || byteOffset < 0 || byteOffset > safeRange.safeByteLength) {
		return undefined;
	}

	return {
		...safeRange,
		byteAddress: safeRange.byteAddress + byteOffset,
		safeByteLength: safeRange.safeByteLength - byteOffset,
	};
}

function evaluateBinaryExpression(left: Const, right: Const, operator: CompileTimeOperator): Const {
	const value =
		operator === '+'
			? left.value + right.value
			: operator === '-'
				? left.value - right.value
				: operator === '*'
					? left.value * right.value
					: operator === '/'
						? left.value / right.value
						: left.value ** right.value;
	const isFloat64 = !!left.isFloat64 || !!right.isFloat64;
	const isInteger = !isFloat64 && left.isInteger && right.isInteger && Number.isInteger(value);
	const safeRange =
		isInteger && operator === '+' && left.address?.safeRange && right.isInteger
			? shiftSafeRange(left.address.safeRange, right.value)
			: isInteger && operator === '+' && right.address?.safeRange && left.isInteger
				? shiftSafeRange(right.address.safeRange, left.value)
				: isInteger && operator === '-' && left.address?.safeRange && right.isInteger
					? shiftSafeRange(left.address.safeRange, -right.value)
					: undefined;

	return {
		value,
		isInteger,
		...(isFloat64 ? { isFloat64: true } : {}),
		...(safeRange ? { address: { safeRange } } : {}),
	};
}

/** Explicit rounding converts the value to an integer and invalidates precision and address metadata. */
function applyRounding(resolved: Const, rounding: CompileTimeRoundingValue | undefined): Const {
	if (rounding === undefined) {
		return resolved;
	}

	const value =
		rounding === CompileTimeRounding.FLOOR
			? Math.floor(resolved.value)
			: rounding === CompileTimeRounding.CEIL
				? Math.ceil(resolved.value)
				: resolved.value < 0
					? -Math.round(-resolved.value)
					: Math.round(resolved.value);

	return {
		value,
		isInteger: Number.isInteger(value),
	};
}

/** Resolves and evaluates a compile-time expression with pass-owned operand lookup. */
export function resolveCompileTimeExpression(
	expression: ArgumentCompileTimeExpression,
	resolveOperand: CompileTimeOperandResolver
): Const | undefined {
	const left = resolveOperand(expression.left);
	if (left === undefined) {
		return undefined;
	}

	if (!isBinaryCompileTimeExpression(expression)) {
		return applyRounding(left, expression.rounding);
	}

	const right = resolveOperand(expression.right);
	if (right === undefined || (expression.operator === '/' && right.value === 0)) {
		return undefined;
	}

	return applyRounding(evaluateBinaryExpression(left, right, expression.operator), expression.rounding);
}
