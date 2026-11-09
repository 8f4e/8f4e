import { localSet } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler, ResolvedLocalSetLine } from '@8f4e/language-spec';

import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `localSet`.
 * @see [Instruction docs](../../docs/instructions/declarations-and-locals.md)
 */
const _localSet: InstructionCompiler<ResolvedLocalSetLine> = (line, context) => {
	return saveByteCode(context, localSet(line.binding.id));
};

export default _localSet;
