import {
	ArgumentType,
	ErrorCode,
	getError,
	type LocalValueMetadata,
	type MemoryPointerIdentifier,
	type PushLine,
	type ResolvedLocalPointerPushLine,
	type ResolvedLocalPushLine,
	type ResolvedMemoryPointerPushLine,
	type ResolvedMemoryPushLine,
	type SemanticPushLine,
} from '@8f4e/language-spec';
import { getResolvedMemoryDeclaration } from '@8f4e/semantic-utils';
import type { ReferenceResolutionContext } from '../context';
import { validateIntermoduleAddressReference, validateUnresolvedValueExpression } from './helpers';

function isResolvedPointerLocal(
	local: ReferenceResolutionContext['locals'][string] | undefined
): local is Extract<LocalValueMetadata, { pointeeBaseType: string }> {
	return !!local?.pointeeBaseType;
}

function getDeclaredPointerDepth(pointerMetadata: { pointerDepth: number; pointeeBaseType?: unknown }): number {
	return pointerMetadata.pointeeBaseType ? pointerMetadata.pointerDepth : 0;
}

function validateDereferenceDepth(
	pointerArgument: MemoryPointerIdentifier,
	pointerMetadata: { pointerDepth: number; pointeeBaseType?: unknown },
	line: PushLine,
	context: ReferenceResolutionContext
): void {
	if (pointerArgument.dereferenceDepth > getDeclaredPointerDepth(pointerMetadata)) {
		throw getError(ErrorCode.POINTER_DEREFERENCE_DEPTH_EXCEEDED, line, context, {
			identifier: pointerArgument.value,
		});
	}
}

function throwIfPointeeCountIsUnknown(line: PushLine, context: ReferenceResolutionContext): void {
	const argument = line.arguments[0];
	if (argument?.type !== ArgumentType.IDENTIFIER || argument.referenceKind !== 'pointee-element-count') {
		return;
	}

	const base = argument.targetMemoryId;
	const pointerMetadata = getResolvedMemoryDeclaration(context, base) ?? context.locals[base];
	if (pointerMetadata?.pointeeBaseType && pointerMetadata.pointeeElementCount === undefined) {
		throw getError(ErrorCode.POINTEE_ELEMENT_COUNT_UNKNOWN, line, context, { identifier: argument.value });
	}
}

/**
 * Resolves value arguments for the `push` instruction.
 * For identifier arguments, validates that the identifier is a known memory item, pointer,
 * memory reference, local, or valid intermodule reference.
 * Throws UNDECLARED_IDENTIFIER for unrecognized identifiers.
 *
 * @param line - Source AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns Push line with resolved target metadata where needed.
 */
export default function resolvePushReferences(line: PushLine, context: ReferenceResolutionContext): SemanticPushLine {
	throwIfPointeeCountIsUnknown(line, context);

	const argument = line.arguments[0];
	if (argument?.type === ArgumentType.COMPILE_TIME_EXPRESSION) {
		validateUnresolvedValueExpression(argument, line, context);
	}
	if (argument?.type === ArgumentType.IDENTIFIER) {
		const { value, referenceKind } = argument;
		validateIntermoduleAddressReference(argument, line, context);
		if (referenceKind === 'plain') {
			const local = context.locals[value];
			if (local) {
				const resolvedLine: Omit<ResolvedLocalPushLine, 'resolvedTarget'> = {
					...line,
					arguments: [argument],
				};
				return { ...resolvedLine, resolvedTarget: { kind: 'local' as const, binding: context.bindingsByName[value]! } };
			}

			const memoryItem = getResolvedMemoryDeclaration(context, value);
			if (memoryItem) {
				const resolvedLine: Omit<ResolvedMemoryPushLine, 'resolvedTarget'> = {
					...line,
					arguments: [argument],
				};
				return { ...resolvedLine, resolvedTarget: { kind: 'memory' as const, memoryItem } };
			}
		}
		if (referenceKind === 'memory-pointer') {
			const pointerArgument = argument as MemoryPointerIdentifier;
			const memoryItem = getResolvedMemoryDeclaration(context, pointerArgument.targetMemoryId);
			if (memoryItem) {
				if (pointerArgument.dereferenceDepth === 0 && !memoryItem.pointeeBaseType) {
					throw getError(ErrorCode.POINTEE_ADDRESS_REQUIRES_POINTER, line, context, {
						identifier: pointerArgument.value,
					});
				}
				validateDereferenceDepth(pointerArgument, memoryItem, line, context);
				const resolvedLine: Omit<ResolvedMemoryPointerPushLine, 'resolvedTarget'> = {
					...line,
					arguments: [pointerArgument],
				};
				return { ...resolvedLine, resolvedTarget: { kind: 'memory-pointer' as const, memoryItem } };
			}

			const local = context.locals[pointerArgument.targetMemoryId];
			if (pointerArgument.dereferenceDepth === 0 && local && !isResolvedPointerLocal(local)) {
				throw getError(ErrorCode.POINTEE_ADDRESS_REQUIRES_POINTER, line, context, {
					identifier: pointerArgument.value,
				});
			}
			if (isResolvedPointerLocal(local)) {
				validateDereferenceDepth(pointerArgument, local, line, context);
				const resolvedLine: Omit<ResolvedLocalPointerPushLine, 'resolvedTarget'> = {
					...line,
					arguments: [pointerArgument],
				};
				return {
					...resolvedLine,
					resolvedTarget: {
						kind: 'local-pointer' as const,
						binding: context.bindingsByName[pointerArgument.targetMemoryId]!,
					},
				};
			}
		}

		throw getError(ErrorCode.UNDECLARED_IDENTIFIER, line, context, { identifier: value });
	}

	return line as SemanticPushLine;
}
