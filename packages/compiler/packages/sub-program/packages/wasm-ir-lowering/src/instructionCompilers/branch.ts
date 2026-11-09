import { br } from '@8f4e/compiler-wasm-utils';
import type { BranchLine, InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `branch`.
 * @see [Instruction docs](../../docs/instructions/control-flow.md)
 */
const branch: InstructionCompiler<BranchLine> = (line: BranchLine, context) => {
	return saveByteCode(context, br(line.arguments[0].value));
};

export default branch;
