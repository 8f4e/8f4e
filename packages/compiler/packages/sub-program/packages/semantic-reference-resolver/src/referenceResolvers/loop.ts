import { getError } from '@8f4e/compiler-diagnostics';
import type { LoopLine, ResolvedLoopLine } from '@8f4e/language-spec';
import { ArgumentType, ErrorCode } from '@8f4e/language-spec';
import type { ReferenceResolutionContext } from '../context';
import { validateValueArguments } from './helpers';

/**
 * Resolves the optional loop cap into a literal, including directive and default caps.
 * Resolved caps must be non-negative integers.
 *
 * @param line - Source AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns Loop line with resolved cap metadata.
 */
export default function resolveLoopReferences(line: LoopLine, context: ReferenceResolutionContext): ResolvedLoopLine {
	if (line.arguments.length === 0) {
		return { ...line, arguments: [{ type: ArgumentType.LITERAL, value: context.loopCap ?? 1000, isInteger: true }] };
	}

	const resolved = validateValueArguments(line, context, [0]) as ResolvedLoopLine;
	const argument = resolved.arguments[0];

	if (!argument.isInteger) {
		throw getError(ErrorCode.TYPE_MISMATCH, line, { symbol: context.codeBlockId });
	}
	if (argument.value < 0) {
		throw getError(ErrorCode.EXPECTED_VALUE, line, { symbol: context.codeBlockId });
	}

	return resolved;
}
