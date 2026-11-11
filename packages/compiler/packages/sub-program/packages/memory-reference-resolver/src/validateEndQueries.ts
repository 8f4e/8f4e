import { getError } from '@8f4e/compiler-diagnostics';
import {
	type Argument,
	ArgumentType,
	type CompilerASTLine,
	ErrorCode,
	isBinaryCompileTimeExpression,
} from '@8f4e/language-spec';
import type { MemoryReferenceResolutionContext } from './context';

/** Validates end-query targets once their fixed-reference namespace is available. */
export function validateEndQueries(line: CompilerASTLine, context: MemoryReferenceResolutionContext): void {
	function visit(argument: Argument): void {
		if (argument.type === ArgumentType.COMPILE_TIME_EXPRESSION) {
			visit(argument.left);
			if (isBinaryCompileTimeExpression(argument)) visit(argument.right);
		} else if (
			argument.type === ArgumentType.IDENTIFIER &&
			argument.referenceKind === 'end-address' &&
			argument.scope === 'local'
		) {
			const reference = context.referenceSlots[argument.targetMemoryId];
			if (argument.targetKind === 'pointee' && !reference)
				throw getError(ErrorCode.END_QUERY_REQUIRES_FIXED_REFERENCE, line, {
					details: { identifier: argument.targetMemoryId },
				});
			if (argument.targetKind === 'memory' && reference)
				throw getError(ErrorCode.REFERENCE_SLOT_HAS_NO_STORAGE, line, {
					details: { identifier: argument.targetMemoryId },
				});
		}
	}
	line.arguments.forEach(visit);
}
