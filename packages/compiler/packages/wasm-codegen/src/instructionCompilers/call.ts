import { call as wasmCall } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler, SemanticCallLine } from '@8f4e/language-spec';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `call`.
 * @see [Instruction docs](../../docs/instructions/program-structure-and-functions.md)
 */
const call: InstructionCompiler<SemanticCallLine> = (line, context, facts) => {
	const targetFunction = context.functionLayout.functions[facts.targetFunctionId!];
	saveByteCode(context, wasmCall(targetFunction.wasmIndex));

	return context;
};

export default call;
