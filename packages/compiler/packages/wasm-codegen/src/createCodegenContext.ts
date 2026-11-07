import type { CodegenContext, SourceLocalBinding } from '@8f4e/language-spec';
import { createBlockState } from '@8f4e/semantic-utils';
import { allocateLocalFromType } from './localStorage';

/** Initializes bytecode emission state and allocates the resolved source bindings. */
export function createCodegenContext(
	overrides: Partial<CodegenContext> & Pick<CodegenContext, 'functionLayout'>,
	bindings: readonly SourceLocalBinding[] = []
): CodegenContext {
	const context: CodegenContext = {
		byteCode: [],
		locals: {},
		allocatedLocals: [],
		nextLocalIndex: 0,
		...overrides,
		...createBlockState(overrides.blockStack),
	};
	for (const binding of bindings) allocateLocalFromType(context, String(binding.id), binding.type);
	return context;
}
