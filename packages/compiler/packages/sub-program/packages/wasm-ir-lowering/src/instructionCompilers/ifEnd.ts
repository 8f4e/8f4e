import { WASM_END } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';

import { popBlock } from '@8f4e/semantic-utils';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `ifEnd`.
 * @see [Instruction docs](../../docs/instructions/control-flow.md)
 */
const ifEnd: InstructionCompiler = (line, context) => {
	popBlock(context);

	return saveByteCode(context, [WASM_END]);
};

export default ifEnd;
