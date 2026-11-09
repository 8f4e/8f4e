import { WASM_DROP } from '@8f4e/compiler-wasm-utils';
import { assertionFunctionId, type InstructionCompiler, type SemanticAssertEqualLine } from '@8f4e/language-spec';
import { i32const } from '../operations';
import push from './push';
import { saveByteCode } from './utils/saveByteCode';

/** Emits a planned callback or discards the actual stack operand when assertions are disabled. */
export const assert: InstructionCompiler = (_line, context, _facts, site) => {
	if (!site) {
		return saveByteCode(context, [WASM_DROP]);
	}
	return saveByteCode(context, [
		...i32const(site.siteId),
		{ kind: 'call', targetFunctionId: assertionFunctionId(site.fieldName) },
	]);
};

export const assertEqual: InstructionCompiler<SemanticAssertEqualLine> = (line, context, facts, site) => {
	if (site) {
		push(line.expectedPush, context, facts);
	}
	return assert(line, context, facts, site);
};
