import { f32load, f64load, WASM_TYPE_F32, WASM_TYPE_F64 } from '@8f4e/compiler-wasm-utils';
import type { ASTLineBase, FloatLoadInstructionSpecName, InstructionCompiler } from '@8f4e/language-spec';
import { DOUBLE_WORD_MEMORY_ACCESS_WIDTH, getInstructionSpec } from '@8f4e/language-spec';
import { guardedLoad, isSafeMemoryAccess } from './utils/memoryAccessGuard';
import { saveByteCode } from './utils/saveByteCode';

type LoadFloatLine = ASTLineBase<FloatLoadInstructionSpecName, []>;

/**
 * Instruction compiler for `loadFloat`.
 * @see [Instruction docs](../../docs/instructions/memory.md)
 */
const loadFloat: InstructionCompiler<LoadFloatLine> = (line, context, facts) => {
	const [rawAddress] = facts.stackAnalysis.consumedOperands;
	const address = rawAddress;
	const operation = getInstructionSpec(line.instruction).effects.memory;
	const isFloat64 = facts.stackAnalysis.producedStackItems[0].valueType === 'float64';
	const accessByteWidth = isFloat64 ? DOUBLE_WORD_MEMORY_ACCESS_WIDTH : operation.accessByteWidth;

	const instructions = isFloat64 ? f64load(3, 0) : f32load(2, 0);
	if (isSafeMemoryAccess(address, accessByteWidth)) {
		return saveByteCode(context, instructions);
	}

	return saveByteCode(
		context,
		guardedLoad(context, {
			accessByteWidth,
			lineNumber: line.lineNumber,
			resultType: isFloat64 ? WASM_TYPE_F64 : WASM_TYPE_F32,
			loadByteCode: instructions,
		})
	);
};

export default loadFloat;
