import { ErrorCode, getError, type LocalSetLine, type ResolvedLocalSetLine } from '@8f4e/language-spec';
import type { ReferenceResolutionContext } from '../context';

/**
 * Validates that localSet targets an already-declared local.
 * This keeps local existence checks in semantic reference resolution instead of the dispatcher/codegen layers.
 *
 * @param line - Source AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns localSet line with resolved local metadata.
 */
export default function resolveLocalVariableAccess(
	line: LocalSetLine,
	context: ReferenceResolutionContext
): ResolvedLocalSetLine {
	const nameArg = line.arguments[0];
	if (context.referenceSlots[nameArg.value]) {
		throw getError(ErrorCode.REFERENCE_SLOT_CANNOT_BE_REBOUND, line, context, { identifier: nameArg.value });
	}
	if (!context.locals[nameArg.value]) {
		throw getError(ErrorCode.UNDECLARED_IDENTIFIER, line, context, { identifier: nameArg.value });
	}

	return { ...line, binding: context.bindingsByName[nameArg.value]! };
}
