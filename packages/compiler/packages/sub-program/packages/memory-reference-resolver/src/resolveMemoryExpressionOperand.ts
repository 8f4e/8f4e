import type {
	CompileTimeOperand,
	Const,
	MemoryPointerMetadataMap,
	PlannedMemoryDeclaration,
} from '@8f4e/language-spec';
import {
	ArgumentType,
	memoryEndAddressValue,
	memoryStartAddressValue,
	moduleAddressValue,
	type PointerMetadata,
} from '@8f4e/language-spec';

import type { MemoryReferenceResolutionContext } from './context';
import {
	evaluateMetadataQuery,
	getMetadataQuery,
	type MetadataTargetRequest,
	type ResolvedMetadataTarget,
} from './metadataQuery';
import { resolveMemoryTarget, resolveModuleTarget } from './resolveMemoryTarget';

function getPointerMetadata(
	context: MemoryReferenceResolutionContext,
	memoryId: number,
	moduleId = context.moduleName ?? context.currentModule?.id
): MemoryPointerMetadataMap[number] | undefined {
	return moduleId ? context.pointerMetadata[moduleId]?.[memoryId] : undefined;
}

function getPointerFacts(
	context: MemoryReferenceResolutionContext,
	declaration: PlannedMemoryDeclaration | undefined,
	moduleId = context.moduleName ?? context.currentModule?.id
): PointerMetadata | undefined {
	if (!declaration) {
		return undefined;
	}

	return {
		...declaration,
		...getPointerMetadata(context, declaration.id, moduleId),
	};
}

/** Resolves a metadata target once, independently of the query being evaluated. */
export function resolveMetadataTarget(
	request: MetadataTargetRequest,
	context: MemoryReferenceResolutionContext
): ResolvedMetadataTarget | undefined {
	const memory = resolveMemoryTarget(request, context)?.targetMemory;
	if (request.scope === 'intermodule') {
		return memory ? { kind: 'memory', memory } : undefined;
	}
	const referenceSlot = context.referenceSlots[request.targetMemoryId];
	if (referenceSlot && request.dereferenceDepth > 0) {
		return { kind: 'memory', memory: referenceSlot.targetMemory };
	}
	if (request.dereferenceDepth === 0) {
		return memory ? { kind: 'memory', memory } : undefined;
	}

	// The current AST only requests one dereference. Future depth validation belongs here,
	// after target lookup, so memory and local pointers share the same semantic boundary.
	const memoryPointer = getPointerFacts(context, memory);
	const local = context.locals[request.targetMemoryId];
	const localPointer = local?.pointeeBaseType ? local : undefined;
	if (memoryPointer) {
		return { kind: 'pointer', pointers: localPointer ? [memoryPointer, localPointer] : [memoryPointer] };
	}
	return localPointer ? { kind: 'pointer', pointers: [localPointer] } : undefined;
}

/**
 * Tries to resolve a single pre-classified memory/layout expression operand to a value.
 * Dispatches on the operand's AST classification (`type` and `referenceKind`) directly,
 * without re-parsing raw token values.
 *
 * @param operand - Parsed operand to resolve.
 * @param context - Current semantic compilation context.
 * @returns Resolved memory/layout value, or `undefined` when the operand is not a memory expression.
 */
export function resolveMemoryExpressionOperand(
	operand: CompileTimeOperand,
	context: MemoryReferenceResolutionContext
): Const | undefined {
	if (operand.type === ArgumentType.LITERAL) {
		return undefined;
	}
	if (operand.referenceKind === 'plain') {
		const slot = context.referenceSlots[operand.value];
		return slot ? memoryStartAddressValue(slot.targetMemory, slot.targetModuleId) : undefined;
	}

	const metadataQuery = getMetadataQuery(operand);
	if (metadataQuery) {
		const target = resolveMetadataTarget(metadataQuery, context);
		return target ? evaluateMetadataQuery(metadataQuery.query, target) : undefined;
	}

	if (
		operand.referenceKind === 'intermodular-module-reference' ||
		(operand.referenceKind === 'memory-reference' && operand.targetMemoryId === 'this')
	) {
		const targetModule = resolveModuleTarget(
			context,
			operand.scope === 'intermodule' ? operand.targetModuleId : undefined
		);
		return targetModule
			? moduleAddressValue(targetModule, operand.isEndAddress ? 'module-end' : 'module-start', targetModule.id)
			: undefined;
	}

	if (
		operand.referenceKind === 'memory-reference' ||
		operand.referenceKind === 'intermodular-reference' ||
		operand.referenceKind === 'intermodular-module-nth-reference'
	) {
		const target = resolveMemoryTarget(operand, context);
		if (!target) return undefined;
		const { targetMemory, targetModule } = target;
		if (operand.referenceKind !== 'intermodular-module-nth-reference') {
			return operand.isEndAddress
				? memoryEndAddressValue(targetMemory, targetModule.id)
				: memoryStartAddressValue(targetMemory, targetModule.id);
		}
		return {
			...memoryStartAddressValue(targetMemory, targetModule.id),
			address: {
				safeRange: {
					source: 'module-nth-memory-start',
					byteAddress: targetMemory.byteAddress,
					safeByteLength: targetMemory.allocatedByteLength,
					moduleId: targetModule.id,
					memoryId: targetMemory.id,
				},
			},
		};
	}

	return undefined;
}
