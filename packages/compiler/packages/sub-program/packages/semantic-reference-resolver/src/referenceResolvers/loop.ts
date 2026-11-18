import { getError } from '@8f4e/compiler-diagnostics';
import type { LoopLine, ResolvedArgumentLiteral, ResolvedLoopLine } from '@8f4e/language-spec';
import { ArgumentType, ErrorCode } from '@8f4e/language-spec';
import type { ReferenceResolutionContext } from '../context';
import { validateValueArguments } from './helpers';

/**
 * Resolves the explicit or default bound for loops without an implicit runtime operand.
 *
 * @param line - Source AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns Loop line with resolved cap metadata.
 */
export default function resolveLoopReferences(line: LoopLine, context: ReferenceResolutionContext): ResolvedLoopLine {
	if (line.runtimeBound) {
		return line;
	}
	if (line.arguments.length === 0) {
		return { ...line, arguments: [{ type: ArgumentType.LITERAL, value: context.loopCap ?? 1000, isInteger: true }] };
	}

	const argument = validateValueArguments(line, context, [0]).arguments[0] as ResolvedArgumentLiteral;

	if (!argument.isInteger) {
		throw getError(ErrorCode.TYPE_MISMATCH, line, { symbol: context.codeBlockId });
	}
	if (argument.value < 0) {
		throw getError(ErrorCode.EXPECTED_VALUE, line, { symbol: context.codeBlockId });
	}

	return { ...line, arguments: [argument] };
}
