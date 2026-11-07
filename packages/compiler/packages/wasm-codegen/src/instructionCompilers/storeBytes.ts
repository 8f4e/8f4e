import { i32store8, localGet, localSet } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler, StoreBytesLine } from '@8f4e/language-spec';
import { getInstructionSpec } from '@8f4e/language-spec';
import { allocateMemoryGuardLocal, guardedStoreFromLocals, isSafeMemoryAccess } from './utils/memoryAccessGuard';
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
	const addressIsSafe = isSafeMemoryAccess(address, count);

	const tempAddrLocal = allocateMemoryGuardLocal(context, {
		valueType: 'int',
	});
	const tempByteLocal = allocateMemoryGuardLocal(context, {
		valueType: 'int',
	});

	const byteCode = [...localSet(tempAddrLocal.index)];
	for (let i = 0; i < count; i++) {
		const storeByteCode = i32store8(undefined, undefined, 0, i);
		byteCode.push(
			...localSet(tempByteLocal.index),
			...(addressIsSafe
				? [...localGet(tempAddrLocal.index), ...localGet(tempByteLocal.index), ...storeByteCode]
				: guardedStoreFromLocals(tempAddrLocal.index, tempByteLocal.index, i + accessByteWidth, storeByteCode))
		);
	}

	return saveByteCode(context, byteCode);
};

export default storeBytes;
