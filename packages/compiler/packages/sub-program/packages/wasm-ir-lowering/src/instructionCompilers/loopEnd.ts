import { br, WASM_END } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler } from '@8f4e/language-spec';

import { popBlock } from '@8f4e/semantic-utils';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `loopEnd`.
 * @see [Instruction docs](../../docs/instructions/control-flow.md)
 */
const loopEnd: InstructionCompiler = (line, context) => {
	popBlock(context);

	return saveByteCode(context, [...br(0), WASM_END, WASM_END]);
};

export default loopEnd;
