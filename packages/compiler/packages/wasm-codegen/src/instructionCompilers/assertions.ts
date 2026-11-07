import { call, i32const, WASM_DROP } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler, SemanticAssertEqualLine } from '@8f4e/language-spec';
import push from './push';
import { saveByteCode } from './utils/saveByteCode';

/** Emits a planned callback or discards the actual stack operand when assertions are disabled. */
export const assert: InstructionCompiler = (line, context) => {
	if (!context.assertionCall) {
		return saveByteCode(context, [WASM_DROP]);
	}
	const site = context.assertionCall;
	return saveByteCode(context, [
		...i32const(site.siteId),
		...call(context.functionLayout.assertionCallbacks.get(site.fieldName)!),
	]);
};

export const assertEqual: InstructionCompiler<SemanticAssertEqualLine> = (line, context, facts) => {
	if (context.assertionCall) {
		push(line.expectedPush, context, facts);
	}
	return assert(line, context, facts);
};
