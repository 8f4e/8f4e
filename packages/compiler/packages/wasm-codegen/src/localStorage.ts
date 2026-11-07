import type { FunctionValueType, LocalBinding, LocalStorageMap, LocalValueMetadata } from '@8f4e/language-spec';
import { functionValueTypeToLocalMetadata } from '@8f4e/language-spec';

type LocalAllocationContext = { locals: LocalStorageMap; nextLocalIndex: number };

function registerLocal(context: LocalAllocationContext, name: string, local: LocalBinding): LocalBinding {
	context.locals[name] = local;
	context.nextLocalIndex += 1;
	return local;
}

/** Allocates and registers one named local binding at the next available index. */
export function allocateLocal(
	context: LocalAllocationContext,
	name: string,
	binding: LocalValueMetadata
): LocalBinding {
	return registerLocal(context, name, { ...binding, index: context.nextLocalIndex } as LocalBinding);
}

/** Allocates a local binding from a source-language function value type. */
export function allocateLocalFromType(
	context: LocalAllocationContext,
	name: string,
	type: FunctionValueType
): LocalBinding {
	return allocateLocal(context, name, functionValueTypeToLocalMetadata(type));
}

/** Allocates a fresh temporary and retains its declaration independently of source locations. */
export function allocateTemporaryLocal(context: LocalAllocationContext, binding: LocalValueMetadata): LocalBinding {
	return allocateLocal(context, `__temporary_${context.nextLocalIndex}`, binding);
}
