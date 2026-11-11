import { getError } from '@8f4e/compiler-diagnostics';
import { ArgumentType, ErrorCode, type MemoryCopyLine, type ResolvedMemoryCopyLine } from '@8f4e/language-spec';
import type { ReferenceResolutionContext } from '../context';
import { validateValueArguments } from './helpers';

/**
 * Resolves and validates the byte-length argument for `memoryCopy`.
 *
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns The computed result.
 */
export default function resolveMemoryCopyReferences(
	line: MemoryCopyLine,
	context: ReferenceResolutionContext
): ResolvedMemoryCopyLine | MemoryCopyLine {
	const resolved = validateValueArguments(line, context, [0]);

	const argument = resolved.arguments[0];
	if (argument?.type === ArgumentType.LITERAL && !argument.isInteger) {
		throw getError(ErrorCode.TYPE_MISMATCH, line, context);
	}
	if (argument?.type === ArgumentType.LITERAL && argument.value < 0) {
		throw getError(ErrorCode.EXPECTED_VALUE, line, context);
	}

	return resolved as ResolvedMemoryCopyLine | MemoryCopyLine;
}
