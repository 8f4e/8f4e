import type { CodegenContext, SourceLocalBinding } from '@8f4e/language-spec';
import { functionValueTypeToLocalMetadata, WASM_MEMORY_PAGE_SIZE } from '@8f4e/language-spec';
import { createBlockState } from '@8f4e/semantic-utils';
import { allocateLocal } from './localStorage';

/** Initializes Wasm lowering state and allocates the resolved source bindings. */
export function createCodegenContext(
	overrides: Partial<CodegenContext>,
	bindings: readonly SourceLocalBinding[] = []
): CodegenContext {
	const context: CodegenContext = {
		instructions: [],
		locals: [],
		enableMemoryGuards: true,
		minimumMemoryBytes: WASM_MEMORY_PAGE_SIZE,
		...overrides,
		...createBlockState(overrides.blockStack),
	};
	// The resolver assigns binding IDs in declaration order, with parameters first.
	for (const binding of bindings) allocateLocal(context, functionValueTypeToLocalMetadata(binding.type));
	return context;
}
