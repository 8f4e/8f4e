import type { ASTLineBase, InstructionCompiler } from '@8f4e/language-spec';
import {
	BYTE_MEMORY_ACCESS_WIDTH,
	DOUBLE_WORD_MEMORY_ACCESS_WIDTH,
	getInstructionSpec,
	HALF_WORD_MEMORY_ACCESS_WIDTH,
	WORD_MEMORY_ACCESS_WIDTH,
} from '@8f4e/language-spec';
import { f32store, f64store, i32store, i32store8, i32store16 } from '../operations';
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
	const pointee = operand2Address.kind === 'address' ? operand2Address.pointsTo : undefined;
	const baseType = pointee?.pointerDepth === 1 ? pointee.baseType : undefined;
	const integerAccessByteWidth =
		baseType === 'int8' || baseType === 'int8u'
			? BYTE_MEMORY_ACCESS_WIDTH
			: baseType === 'int16' || baseType === 'int16u'
				? HALF_WORD_MEMORY_ACCESS_WIDTH
				: WORD_MEMORY_ACCESS_WIDTH;
	const accessByteWidth = valueIsInteger
		? integerAccessByteWidth
		: valueIsFloat64
			? DOUBLE_WORD_MEMORY_ACCESS_WIDTH
			: WORD_MEMORY_ACCESS_WIDTH;
	const instructions = valueIsInteger
		? accessByteWidth === BYTE_MEMORY_ACCESS_WIDTH
			? i32store8()
			: accessByteWidth === HALF_WORD_MEMORY_ACCESS_WIDTH
				? i32store16()
				: i32store()
		: valueIsFloat64
			? f64store()
			: f32store();
	if (!context.enableMemoryGuards || isSafeMemoryAccess(operand2Address, accessByteWidth)) {
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
