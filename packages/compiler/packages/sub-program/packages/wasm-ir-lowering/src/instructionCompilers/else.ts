import { WASM_ELSE } from '@8f4e/compiler-wasm-utils';
import type { ConditionBlockStackFrame, InstructionCompiler } from '@8f4e/language-spec';

import { popBlock, pushBlock } from '@8f4e/semantic-utils';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `else`.
 * @see [Instruction docs](../../docs/instructions/control-flow.md)
 */
const _else: InstructionCompiler = (line, context) => {
	const block = popBlock(context) as ConditionBlockStackFrame;

	pushBlock(context, block);

	return saveByteCode(context, [WASM_ELSE]);
};

export default _else;
