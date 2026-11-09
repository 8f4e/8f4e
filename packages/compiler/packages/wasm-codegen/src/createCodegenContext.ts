import type { CodegenContext, SourceLocalBinding } from '@8f4e/language-spec';
import { functionValueTypeToLocalMetadata } from '@8f4e/language-spec';
import { createBlockState } from '@8f4e/semantic-utils';
import { allocateLocal } from './localStorage';

/** Initializes bytecode emission state and allocates the resolved source bindings. */
export function createCodegenContext(
	overrides: Partial<CodegenContext> & Pick<CodegenContext, 'functionLayout'>,
	bindings: readonly SourceLocalBinding[] = []
): CodegenContext {
	const context: CodegenContext = {
		byteCode: [],
		locals: [],
		...overrides,
		...createBlockState(overrides.blockStack),
	};
	// The resolver assigns binding IDs in declaration order, with parameters first.
	for (const binding of bindings) allocateLocal(context, functionValueTypeToLocalMetadata(binding.type));
	return context;
}
