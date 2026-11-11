import { getError } from '@8f4e/compiler-diagnostics';
import type { CompilationContext, CompilerASTLine, ResolvedLocalSetLine, Stack } from '@8f4e/language-spec';
import { ErrorCode, stackItemMatchesFunctionValueType } from '@8f4e/language-spec';
import { consume } from './stack';

/**
 * Consumes the assigned value and checks it against the resolved local binding type.
 *
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns The relevant stack items for the analysis step.
 */
export function analyzeLocalSet(
	line: CompilerASTLine,
	context: CompilationContext
): { consumed: Stack; produced: Stack } {
	const consumed = consume(context, 1);
	const operand = consumed[0];
	const localName = (line as ResolvedLocalSetLine).binding.id;
	const local = context.locals[localName]!;

	if (local.isInteger && operand.valueType !== 'int') {
		throw getError(ErrorCode.ONLY_INTEGERS, line, { symbol: context.codeBlockId });
	}

	if (!local.isInteger && operand.valueType === 'int') {
		throw getError(ErrorCode.ONLY_FLOATS, line, { symbol: context.codeBlockId });
	}

	if (!local.isInteger && (operand.valueType === 'float64') !== !!local.isFloat64) {
		throw getError(ErrorCode.MIXED_FLOAT_WIDTH, line, { symbol: context.codeBlockId });
	}

	if (!stackItemMatchesFunctionValueType(operand, (line as ResolvedLocalSetLine).binding.type)) {
		throw getError(ErrorCode.TYPE_MISMATCH, line, { symbol: context.codeBlockId });
	}

	return { consumed, produced: [] };
}
