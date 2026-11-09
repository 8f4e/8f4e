import { br_if } from '@8f4e/compiler-wasm-utils';
import type { BranchIfTrueLine, InstructionCompiler } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `branchIfTrue`.
 * @see [Instruction docs](../../docs/instructions/control-flow.md)
 */
const branchIfTrue: InstructionCompiler<BranchIfTrueLine> = (line: BranchIfTrueLine, context) => {
	return saveByteCode(context, br_if(line.arguments[0].value));
};

export default branchIfTrue;
