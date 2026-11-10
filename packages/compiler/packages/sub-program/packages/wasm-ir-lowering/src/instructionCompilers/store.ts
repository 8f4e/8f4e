import type { ASTLineBase, InstructionCompiler } from '@8f4e/language-spec';
import { DOUBLE_WORD_MEMORY_ACCESS_WIDTH, getInstructionSpec, WORD_MEMORY_ACCESS_WIDTH } from '@8f4e/language-spec';
import { f32store, f64store, i32store } from '../operations';
import { guardedStore, isSafeMemoryAccess } from './utils/memoryAccessGuard';
import { saveByteCode } from './utils/saveByteCode';

type StoreLine = ASTLineBase<'store', []>;

/**
 * Instruction compiler for `store`.
 * @see [Instruction docs](../../docs/instructions/memory.md)
 */
const store: InstructionCompiler<StoreLine> = (line, context, facts) => {
	const operation = getInstructionSpec(line.instruction).effects.memory;
	const operand2Address = facts.stackAnalysis.consumedOperands[operation.addressOperandIndex];
	const operand1Value = facts.stackAnalysis.consumedOperands[operation.valueOperandIndex];
	const valueIsInteger = operand1Value.valueType === 'int';
	const valueIsFloat64 = operand1Value.valueType === 'float64';
	const instructions = valueIsInteger ? i32store(2, 0) : valueIsFloat64 ? f64store(3, 0) : f32store(2, 0);
	const accessByteWidth = valueIsFloat64 ? DOUBLE_WORD_MEMORY_ACCESS_WIDTH : WORD_MEMORY_ACCESS_WIDTH;
	if (isSafeMemoryAccess(operand2Address, accessByteWidth)) {
		return saveByteCode(context, instructions);
	}

	return saveByteCode(
		context,
		guardedStore(context, {
			value: operand1Value,
			accessByteWidth,
			storeByteCode: instructions,
		})
	);
};

export default store;
