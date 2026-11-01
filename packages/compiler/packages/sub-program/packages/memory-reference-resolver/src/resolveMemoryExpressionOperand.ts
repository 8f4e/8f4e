import type {
	CompileTimeOperand,
	Const,
	LocalMap,
	MemoryLayoutPlan,
	MemoryPointerMetadataMap,
	PlannedMemoryDeclaration,
	PlannedMemoryModule,
	ProjectMemoryAliasLookup,
} from '@8f4e/language-spec';
import {
	ArgumentType,
	memoryEndAddressValue,
	memoryStartAddressValue,
	moduleAddressValue,
	type PointerMetadata,
	resolveProjectMemoryAlias,
} from '@8f4e/language-spec';

import {
	evaluateMetadataQuery,
	getMetadataQuery,
	type MetadataTargetRequest,
	type ResolvedMetadataTarget,
} from './metadataQuery';

export type MemoryReferenceModuleNamespace = PlannedMemoryModule;

export type MemoryReferencePointerMetadataByModuleId = Record<string, MemoryPointerMetadataMap>;

export interface MemoryReferenceResolutionContext {
	memoryPlan: MemoryLayoutPlan;
	memoryAliases: ProjectMemoryAliasLookup;
	currentModule?: PlannedMemoryModule;
	pointerMetadata: MemoryReferencePointerMetadataByModuleId;
	moduleName?: string;
	locals: LocalMap;
}

function getCurrentModuleId(context: MemoryReferenceResolutionContext): string | undefined {
	return context.moduleName ?? context.currentModule?.id;
}

function getCurrentModule(context: MemoryReferenceResolutionContext): PlannedMemoryModule | undefined {
	const moduleId = getCurrentModuleId(context);
	return context.currentModule ?? (moduleId ? context.memoryPlan.modules[moduleId] : undefined);
}

function getModule(
	context: MemoryReferenceResolutionContext,
	moduleId: string | undefined
): PlannedMemoryModule | undefined {
	if (!moduleId || moduleId === 'this') {
		return getCurrentModule(context);
	}

	return context.memoryPlan.modules[moduleId];
}

function getMemoryDeclaration(
	context: MemoryReferenceResolutionContext,
	memoryId: string,
	moduleId = getCurrentModuleId(context)
): PlannedMemoryDeclaration | undefined {
	return getModule(context, moduleId)?.memory[memoryId];
}

/** Resolves one structured intermodule reference through project aliases and the completed memory plan. */
export function resolveIntermoduleMemoryTarget(
	context: MemoryReferenceResolutionContext,
	targetModuleId: string,
	targetMemoryId: string
): {
	targetModuleId: string;
	targetMemoryId: string;
	targetModule: PlannedMemoryModule | undefined;
	targetMemory: PlannedMemoryDeclaration | undefined;
} {
	const canonicalTarget = resolveProjectMemoryAlias(context.memoryAliases, targetModuleId, targetMemoryId);
	const targetModule = getModule(context, canonicalTarget.targetModuleId);
	return {
		...canonicalTarget,
		targetModule,
		targetMemory: targetModule?.memory[canonicalTarget.targetMemoryId],
	};
}

function getPointerMetadata(
	context: MemoryReferenceResolutionContext,
	memoryId: string,
	moduleId = getCurrentModuleId(context)
): MemoryPointerMetadataMap[string] | undefined {
	return moduleId ? context.pointerMetadata[moduleId]?.[memoryId] : undefined;
}

function getPointerFacts(
	context: MemoryReferenceResolutionContext,
	declaration: PlannedMemoryDeclaration | undefined,
	moduleId = getCurrentModuleId(context)
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
	if (request.scope === 'intermodule') {
		const { targetMemory } = resolveIntermoduleMemoryTarget(context, request.targetModuleId, request.targetMemoryId);
		return targetMemory ? { kind: 'memory', memory: targetMemory } : undefined;
	}

	const memory = getMemoryDeclaration(context, request.targetMemoryId);
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

	const metadataQuery = getMetadataQuery(operand);
	if (metadataQuery) {
		const target = resolveMetadataTarget(metadataQuery, context);
		return target ? evaluateMetadataQuery(metadataQuery.query, target) : undefined;
	}

	// &module: — start byte address of a module
	// module:& — end-word base byte address of a module
	if (operand.referenceKind === 'intermodular-module-reference') {
		const targetModuleId = operand.targetModuleId;
		const targetModule = getModule(context, targetModuleId);
		if (targetModule) {
			return moduleAddressValue(targetModule, operand.isEndAddress ? 'module-end' : 'module-start', targetModuleId);
		}
		return undefined;
	}

	// &module:N — start byte address of the Nth memory item (0-indexed) within a module
	// &this:N — start byte address of the Nth memory item (0-indexed) within the current module
	if (operand.referenceKind === 'intermodular-module-nth-reference') {
		const targetModuleId = operand.targetModuleId;
		const targetModule = getModule(context, targetModuleId);
		const item = targetModule?.declarations[operand.targetMemoryIndex];
		if (item) {
			const resolvedModuleId = targetModuleId === 'this' ? getCurrentModuleId(context) : targetModuleId;
			return {
				...memoryStartAddressValue(item, resolvedModuleId),
				address: {
					safeRange: {
						source: 'module-nth-memory-start',
						byteAddress: item.byteAddress,
						safeByteLength: item.allocatedByteLength,
						moduleId: resolvedModuleId,
						...(item.id ? { memoryId: item.id } : {}),
					},
				},
			};
		}
		return undefined;
	}

	// &module:memory — start byte address of a remote memory item
	// module:memory& — end-word base byte address of a remote memory item
	if (operand.referenceKind === 'intermodular-reference') {
		const { targetModuleId, targetMemory } = resolveIntermoduleMemoryTarget(
			context,
			operand.targetModuleId,
			operand.targetMemoryId
		);
		if (targetMemory) {
			return operand.isEndAddress
				? memoryEndAddressValue(targetMemory, targetModuleId)
				: memoryStartAddressValue(targetMemory, targetModuleId);
		}
		return undefined;
	}

	// &name — start byte address of a local memory item
	// name& — end-word base byte address of a local memory item
	if (operand.referenceKind === 'memory-reference') {
		const base = operand.targetMemoryId;
		if (base === 'this') {
			const currentModule = getCurrentModule(context);
			if (!currentModule) {
				return undefined;
			}

			if (!operand.isEndAddress) {
				return moduleAddressValue(currentModule, 'module-start', currentModule.id);
			}

			return moduleAddressValue(currentModule, 'module-end', currentModule.id);
		}
		const memoryItem = getMemoryDeclaration(context, base);
		if (memoryItem) {
			return operand.isEndAddress
				? memoryEndAddressValue(memoryItem, context.moduleName)
				: memoryStartAddressValue(memoryItem, context.moduleName);
		}
		return undefined;
	}

	return undefined;
}
