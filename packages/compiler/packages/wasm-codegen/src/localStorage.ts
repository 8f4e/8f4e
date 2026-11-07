import type {
	CodegenContext,
	FunctionValueType,
	LocalBinding,
	LocalStorageMap,
	LocalValueMetadata,
} from '@8f4e/language-spec';
import { functionValueTypeToLocalMetadata } from '@8f4e/language-spec';

type LocalAllocationContext = { locals: LocalStorageMap; allocatedLocals: LocalBinding[]; nextLocalIndex: number };

/** Physical locals in allocation order across the caller's source scope and any inline scopes. */
export function getCodegenLocals(context: CodegenContext): LocalBinding[] {
	return context.allocatedLocals;
}

function registerLocal(context: LocalAllocationContext, name: string, local: LocalBinding): LocalBinding {
	context.locals[name] = local;
	return local;
}

/** Allocates anonymous physical storage; consumers retain the returned handle for its lifetime. */
export function allocateTemporaryLocal(context: LocalAllocationContext, binding: LocalValueMetadata): LocalBinding {
	const local = { ...binding, index: context.nextLocalIndex++ } as LocalBinding;
	context.allocatedLocals.push(local);
	return local;
}

/** Allocates and registers one named local binding at the next available index. */
export function allocateLocal(
	context: LocalAllocationContext,
	name: string,
	binding: LocalValueMetadata
): LocalBinding {
	return registerLocal(context, name, allocateTemporaryLocal(context, binding));
}

/** Allocates a local binding from a source-language function value type. */
export function allocateLocalFromType(
	context: LocalAllocationContext,
	name: string,
	type: FunctionValueType
): LocalBinding {
	return allocateLocal(context, name, functionValueTypeToLocalMetadata(type));
}

/** Returns an existing named local binding or allocates it when absent. */
export function getOrCreateLocal(
	context: LocalAllocationContext,
	name: string,
	binding: LocalValueMetadata
): LocalBinding {
	return context.locals[name] ?? allocateLocal(context, name, binding);
}
