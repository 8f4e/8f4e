import type { InstructionCompiler, SemanticCallLine } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `call`.
 * @see [Instruction docs](../../docs/instructions/program-structure-and-functions.md)
 */
const call: InstructionCompiler<SemanticCallLine> = (_line, context, facts) =>
	saveByteCode(context, [{ kind: 'call', targetFunctionId: facts.targetFunctionId! }]);

export default call;
