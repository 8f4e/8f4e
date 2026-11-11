import { getError } from '@8f4e/compiler-diagnostics';
import type { CompilationContext, CompilerASTLine, OperandRule, StackItem } from '@8f4e/language-spec';
import { ErrorCode } from '@8f4e/language-spec';
import { areAllOperandsIntegers } from '@8f4e/semantic-utils';
import { inferErrorCodeFromRule } from './inferErrorCodeFromRule';

function areAllOperandsFloats(...operands: StackItem[]): boolean {
	return operands.every(operand => operand.valueType === 'float' || operand.valueType === 'float64');
}

function hasMixedFloatWidth(...operands: StackItem[]): boolean {
	const floats = operands.filter(op => op.valueType === 'float' || op.valueType === 'float64');
	return floats.some(op => op.valueType === 'float64') && floats.some(op => op.valueType === 'float');
}

/**
 * Enforces operand type rules from the instruction spec against already-peeked stack operands.
 *
 * @param operands - Stack operands to inspect.
 * @param rule - Operand rule from the language spec.
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns Nothing.
 */
export function validateOperandTypes(
	operands: StackItem[],
	rule: OperandRule | OperandRule[],
	line: CompilerASTLine,
	context: CompilationContext
): void {
	const errorCode = inferErrorCodeFromRule(rule);

	if (Array.isArray(rule)) {
		for (let i = 0; i < rule.length && i < operands.length; i++) {
			const operand = operands[i];
			const expectedType = rule[i];

			if (expectedType === 'int' && operand.valueType !== 'int') {
				throw getError(errorCode, line, context);
			} else if (expectedType === 'float' && operand.valueType === 'int') {
				throw getError(errorCode, line, context);
			}
		}
	} else if (rule === 'int') {
		if (!areAllOperandsIntegers(...operands)) {
			throw getError(errorCode, line, context);
		}
	} else if (rule === 'float') {
		if (!areAllOperandsFloats(...operands)) {
			throw getError(errorCode, line, context);
		}
	} else if (rule === 'sameType') {
		const [left, right] = operands;
		if (
			left.valueType !== right.valueType ||
			left.kind !== right.kind ||
			(left.kind === 'address' &&
				right.kind === 'address' &&
				(left.pointsTo?.baseType !== right.pointsTo?.baseType ||
					left.pointsTo?.pointerDepth !== right.pointsTo?.pointerDepth))
		) {
			throw getError(errorCode, line, context);
		}
	} else if (rule === 'matching') {
		if (!areAllOperandsIntegers(...operands) && !areAllOperandsFloats(...operands)) {
			throw getError(errorCode, line, context);
		}

		if (hasMixedFloatWidth(...operands)) {
			throw getError(ErrorCode.MIXED_FLOAT_WIDTH, line, context);
		}
	}
}
