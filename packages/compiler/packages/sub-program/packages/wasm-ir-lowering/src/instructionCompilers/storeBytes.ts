import type { InstructionCompiler, StoreBytesLine } from '@8f4e/language-spec';
import { getInstructionSpec, wasmLocalGet as localGet, wasmLocalSet as localSet } from '@8f4e/language-spec';
import { allocateLocal } from '../localStorage';
import { i32store8 } from '../operations';
import { guardedStoreFromLocals, isSafeMemoryAccess } from './utils/memoryAccessGuard';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `storeBytes`.
 * @see [Instruction docs](../../docs/instructions/memory.md)
 */
const storeBytes: InstructionCompiler<StoreBytesLine> = (line, context, facts) => {
	const count = line.arguments[0].value;
	const operation = getInstructionSpec(line.instruction).effects.memory;
	const accessByteWidth = operation.accessByteWidth;

	const address = facts.stackAnalysis.consumedOperands[facts.stackAnalysis.consumedOperands.length - 1];
	const needsGuard = context.enableMemoryGuards && !isSafeMemoryAccess(address, count);

	const addressLocalIndex = allocateLocal(context, { isInteger: true });
	const byteLocalIndex = allocateLocal(context, { isInteger: true });

	const byteCode = [...localSet(addressLocalIndex)];
	for (let i = 0; i < count; i++) {
		const storeByteCode = i32store8(0, i);
		byteCode.push(
			...localSet(byteLocalIndex),
			...(needsGuard
				? guardedStoreFromLocals(addressLocalIndex, byteLocalIndex, i + accessByteWidth, storeByteCode)
				: [...localGet(addressLocalIndex), ...localGet(byteLocalIndex), ...storeByteCode])
		);
	}

	return saveByteCode(context, byteCode);
};

export default storeBytes;
