import { i32const, WASM_DROP } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler, SemanticAssertEqualLine } from '@8f4e/language-spec';
import push from './push';
import { saveByteCode } from './utils/saveByteCode';

/** Emits a planned callback or discards the actual stack operand when assertions are disabled. */
export const assert: InstructionCompiler = (_line, context, _facts, site) => {
	if (!site) {
		return saveByteCode(context, [WASM_DROP]);
	}
	return saveByteCode(context, [...i32const(site.siteId), { kind: 'assertionCall', fieldName: site.fieldName }]);
};

export const assertEqual: InstructionCompiler<SemanticAssertEqualLine> = (line, context, facts, site) => {
	if (site) {
		push(line.expectedPush, context, facts);
	}
	return assert(line, context, facts, site);
};
