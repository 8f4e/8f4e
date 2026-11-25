import { getError } from '@8f4e/compiler-diagnostics';
import {
	type CompilerDiagnosticLine,
	type Const,
	type EndAddressIdentifier,
	ErrorCode,
	memoryEndAddressValue,
	moduleAddressValue,
} from '@8f4e/language-spec';
import type { MemoryReferenceResolutionContext } from './context';
import { resolveMemoryTarget, resolveModuleTarget } from './resolveMemoryTarget';

/** Resolves an exclusive-end query against the completed layout and immutable reference bindings. */
export function resolveEndAddress(
	query: EndAddressIdentifier,
	context: MemoryReferenceResolutionContext,
	line: CompilerDiagnosticLine
): Const | undefined {
	if (query.scope === 'local') {
		const reference = context.referenceSlots[query.targetMemoryId];
		if (query.targetKind === 'pointee') {
			if (!reference)
				throw getError(ErrorCode.END_QUERY_REQUIRES_FIXED_REFERENCE, line, {
					details: { identifier: query.targetMemoryId },
				});
			return memoryEndAddressValue(reference.targetMemory, reference.targetModuleId);
		}
		if (reference)
			throw getError(ErrorCode.REFERENCE_SLOT_HAS_NO_STORAGE, line, {
				details: { identifier: query.targetMemoryId },
			});
	}
	if ((query.scope === 'local' && query.targetMemoryId === 'this') || query.targetKind === 'module') {
		const module = resolveModuleTarget(context, query.scope === 'intermodule' ? query.targetModuleId : undefined);
		return module ? moduleAddressValue(module, 'module-end', module.id) : undefined;
	}
	const target = resolveMemoryTarget(query, context);
	return target ? memoryEndAddressValue(target.targetMemory, target.targetModule.id) : undefined;
}
