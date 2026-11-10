import { WASM_BLOCK } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler, PairedBlockLine } from '@8f4e/language-spec';
import { BlockType } from '@8f4e/language-spec';
import { pushBlock } from '@8f4e/semantic-utils';
import createResultBlockState from './utils/createResultBlockState';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `block`.
 * @see [Instruction docs](../../docs/instructions/control-flow.md)
 */
const block: InstructionCompiler<PairedBlockLine> = (line, context) => {
	const { blockState, wasmBlockType } = createResultBlockState(line.blockBlock.resultTypes, BlockType.BLOCK);

	pushBlock(context, blockState);
	return saveByteCode(context, [{ kind: 'block', opcode: WASM_BLOCK, results: wasmBlockType }]);
};

export default block;
