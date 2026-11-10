import { WASM_IF } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler, PairedIfLine } from '@8f4e/language-spec';
import { BlockType } from '@8f4e/language-spec';
import { pushBlock } from '@8f4e/semantic-utils';
import createResultBlockState from './utils/createResultBlockState';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `if`.
 * @see [Instruction docs](../../docs/instructions/control-flow.md)
 */
const _if: InstructionCompiler<PairedIfLine> = (line, context) => {
	const { blockState, wasmBlockType } = createResultBlockState(line.ifBlock.resultTypes, BlockType.CONDITION);

	pushBlock(context, blockState);
	return saveByteCode(context, [{ kind: 'block', opcode: WASM_IF, results: wasmBlockType }]);
};

export default _if;
