import type { Argument, CompileTimeOperand, Const } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { resolveCompileTimeExpression } from '@8f4e/semantic-utils';
import type { MemoryReferenceResolutionContext } from './context';
import { resolveMemoryExpressionOperand } from './resolveMemoryExpressionOperand';

function resolveValueOperand(
	operand: CompileTimeOperand,
	context: MemoryReferenceResolutionContext
): Const | undefined {
	if (operand.type === ArgumentType.LITERAL) {
		return {
			value: operand.value,
			isInteger: operand.isInteger,
			...(operand.isFloat64 ? { isFloat64: true } : {}),
		};
	}

	return resolveMemoryExpressionOperand(operand, context);
}

/**
 * Attempts to fold an argument into a semantic value using the current memory layout context.
 * Constant identifiers are expected to have been resolved before this pass runs.
 *
 * @param context - Compilation context used by the operation.
 * @param argument - Argument whose resolved value or metadata should be used.
 * @returns Resolved value, or `undefined` when the argument cannot be folded.
 */
export function tryResolveValueArgument(
	context: MemoryReferenceResolutionContext,
	argument: Argument
): Const | undefined {
	if (argument.type !== ArgumentType.IDENTIFIER && argument.type !== ArgumentType.COMPILE_TIME_EXPRESSION) {
		return undefined;
	}

	if (argument.type === ArgumentType.COMPILE_TIME_EXPRESSION) {
		return resolveCompileTimeExpression(argument, operand => resolveValueOperand(operand, context));
	}

	return resolveValueOperand(argument, context);
}
