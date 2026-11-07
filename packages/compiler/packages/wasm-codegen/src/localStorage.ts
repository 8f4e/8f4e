import type { CodegenContext, FunctionValueType, LocalBinding, LocalValueMetadata } from '@8f4e/language-spec';
import { functionValueTypeToLocalMetadata } from '@8f4e/language-spec';

type LocalAllocationContext = Pick<CodegenContext, 'locals' | 'allocatedLocals' | 'nextLocalIndex'>;

/** Allocates anonymous storage; consumers retain the returned binding for its lifetime. */
export function allocateTemporaryLocal(context: LocalAllocationContext, binding: LocalValueMetadata): LocalBinding {
	const local = { ...binding, index: context.nextLocalIndex } as LocalBinding;
	context.allocatedLocals.push(local);
	context.nextLocalIndex += 1;
	return local;
}

/** Allocates and registers one named local binding at the next available index. */
export function allocateLocal(
	context: LocalAllocationContext,
	name: string,
	binding: LocalValueMetadata
): LocalBinding {
	const local = allocateTemporaryLocal(context, binding);
	context.locals[name] = local;
	return local;
}

/** Allocates a local binding from a source-language function value type. */
export function allocateLocalFromType(
	context: LocalAllocationContext,
	name: string,
	type: FunctionValueType
): LocalBinding {
	return allocateLocal(context, name, functionValueTypeToLocalMetadata(type));
}
