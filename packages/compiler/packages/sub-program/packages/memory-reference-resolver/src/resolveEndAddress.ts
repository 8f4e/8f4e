import { type Const, type EndAddressIdentifier, memoryEndAddressValue, moduleAddressValue } from '@8f4e/language-spec';
import type { MemoryReferenceResolutionContext } from './context';
import { resolveMemoryTarget, resolveModuleTarget } from './resolveMemoryTarget';

/** Resolves an exclusive-end query against the completed layout and immutable reference bindings. */
export function resolveEndAddress(
	query: EndAddressIdentifier,
	context: MemoryReferenceResolutionContext
): Const | undefined {
	if (query.scope === 'local' && query.targetKind === 'pointee') {
		const reference = context.referenceSlots[query.targetMemoryId];
		return reference ? memoryEndAddressValue(reference.targetMemory, reference.targetModuleId) : undefined;
	}
	if ((query.scope === 'local' && query.targetMemoryId === 'this') || query.targetKind === 'module') {
		const module = resolveModuleTarget(context, query.scope === 'intermodule' ? query.targetModuleId : undefined);
		return module ? moduleAddressValue(module, 'module-end', module.id) : undefined;
	}
	const target = resolveMemoryTarget(query, context);
	return target ? memoryEndAddressValue(target.targetMemory, target.targetModule.id) : undefined;
}
