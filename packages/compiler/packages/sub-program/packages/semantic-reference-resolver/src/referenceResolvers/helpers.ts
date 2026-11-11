import { getError } from '@8f4e/compiler-diagnostics';
import {
	type Argument,
	type ArgumentIdentifier,
	ArgumentType,
	type CompilerASTLine,
	ErrorCode,
	isBinaryCompileTimeExpression,
	resolveProjectMemoryAlias,
} from '@8f4e/language-spec';
import type { ReferenceResolutionContext } from '../context';

function getTargetPlannedModule(context: ReferenceResolutionContext, targetModuleId: string) {
	return context.memoryPlan.modules[targetModuleId];
}

/**
 * Validates address references, including fixed-slot storage errors and intermodule targets.
 *
 * @param identifier - identifier value to use.
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns Nothing.
 */
export function validateAddressReference(
	identifier: ArgumentIdentifier,
	line: CompilerASTLine,
	context: ReferenceResolutionContext
): void {
	if (identifier.referenceKind === 'memory-reference' && context.referenceSlots[identifier.targetMemoryId]) {
		throw getError(ErrorCode.REFERENCE_SLOT_HAS_NO_STORAGE, line, {
			symbol: context.codeBlockId,
			details: { identifier: identifier.targetMemoryId },
		});
	}
	if (identifier.referenceKind === 'intermodular-module-reference') {
		const targetModuleId = identifier.targetModuleId;
		if (!getTargetPlannedModule(context, targetModuleId)) {
			throw getError(ErrorCode.UNDECLARED_IDENTIFIER, line, {
				symbol: context.codeBlockId,
				details: { identifier: targetModuleId },
			});
		}
		return;
	}

	if (identifier.referenceKind === 'intermodular-reference') {
		const { targetModuleId, targetMemoryId } = resolveProjectMemoryAlias(
			context.memoryAliases,
			identifier.targetModuleId,
			identifier.targetMemoryId
		);

		const targetModule = getTargetPlannedModule(context, targetModuleId);
		if (!targetModule) {
			throw getError(ErrorCode.UNDECLARED_IDENTIFIER, line, {
				symbol: context.codeBlockId,
				details: { identifier: targetModuleId },
			});
		}

		const targetMemory = targetModule?.memory[targetMemoryId];
		if (!targetMemory) {
			throw getError(ErrorCode.UNDECLARED_IDENTIFIER, line, {
				symbol: context.codeBlockId,
				details: { identifier: targetMemoryId },
			});
		}
		return;
	}

	// For metadata queries (count, sizeof, max, min), validate module and memory existence
	if (
		identifier.referenceKind === 'intermodular-element-count' ||
		identifier.referenceKind === 'intermodular-element-word-size' ||
		identifier.referenceKind === 'intermodular-element-max' ||
		identifier.referenceKind === 'intermodular-element-min'
	) {
		const { targetModuleId, targetMemoryId } = resolveProjectMemoryAlias(
			context.memoryAliases,
			identifier.targetModuleId,
			identifier.targetMemoryId
		);
		const targetModule = getTargetPlannedModule(context, targetModuleId);
		if (!targetModule) {
			throw getError(ErrorCode.UNDECLARED_IDENTIFIER, line, {
				symbol: context.codeBlockId,
				details: { identifier: targetModuleId },
			});
		}
		if (!targetModule?.memory[targetMemoryId]) {
			throw getError(ErrorCode.UNDECLARED_IDENTIFIER, line, {
				symbol: context.codeBlockId,
				details: { identifier: targetMemoryId },
			});
		}
	}
}

/**
 * Validates an unresolved value expression argument and throws UNDECLARED_IDENTIFIER.
 *
 * @param argument - Argument whose resolved value or metadata should be used.
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns Nothing.
 */
export function validateUnresolvedValueExpression(
	argument: Extract<Argument, { type: typeof ArgumentType.COMPILE_TIME_EXPRESSION }>,
	line: CompilerASTLine,
	context: ReferenceResolutionContext
): never {
	if (argument.left.type === ArgumentType.IDENTIFIER) {
		validateAddressReference(argument.left, line, context);
	}
	if (isBinaryCompileTimeExpression(argument) && argument.right.type === ArgumentType.IDENTIFIER) {
		validateAddressReference(argument.right, line, context);
	}
	const expression = isBinaryCompileTimeExpression(argument)
		? `${argument.left.value}${argument.operator}${argument.right.value}`
		: String(argument.left.value);
	throw getError(ErrorCode.UNDECLARED_IDENTIFIER, line, {
		symbol: context.codeBlockId,
		details: {
			identifier: argument.rounding ? `${argument.rounding}(${expression})` : expression,
		},
	});
}

/**
 * Validates an unresolved identifier argument for instructions that require full resolution
 * (e.g. map, default) and throws UNDECLARED_IDENTIFIER.
 *
 * @param argument - Argument whose resolved value or metadata should be used.
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns Nothing.
 */
export function validateUnresolvedIdentifier(
	argument: Extract<Argument, { type: typeof ArgumentType.IDENTIFIER }>,
	line: CompilerASTLine,
	context: ReferenceResolutionContext
): never {
	validateAddressReference(argument, line, context);
	throw getError(ErrorCode.UNDECLARED_IDENTIFIER, line, {
		symbol: context.codeBlockId,
		details: { identifier: argument.value },
	});
}

/**
 * Validates unresolved value expressions or identifiers at indexes that must have
 * been resolved by earlier compiler passes.
 *
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @param indexes - Argument indexes that must be fully resolved.
 * @returns The computed result.
 */
export function validateValueArguments<TLine extends CompilerASTLine>(
	line: TLine,
	context: ReferenceResolutionContext,
	indexes: number[]
): TLine {
	for (const index of indexes) {
		const argument = line.arguments[index];
		if (argument?.type === ArgumentType.COMPILE_TIME_EXPRESSION) {
			validateUnresolvedValueExpression(argument, line, context);
		}
		if (argument?.type === ArgumentType.IDENTIFIER) {
			validateUnresolvedIdentifier(argument, line, context);
		}
	}

	return line;
}
