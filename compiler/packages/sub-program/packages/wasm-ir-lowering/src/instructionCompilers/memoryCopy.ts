import { WASM_DROP } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler, ResolvedMemoryCopyLine } from '@8f4e/language-spec';
import { getInstructionSpec } from '@8f4e/language-spec';
import { i32const, memoryCopy as wasmMemoryCopy } from '../operations';
import { guardedMemoryCopy, isSafeMemoryAccess } from './utils/memoryAccessGuard';
import { saveByteCode } from './utils/saveByteCode';

/**
 * Instruction compiler for `memoryCopy`.
 * @see [Instruction docs](../../docs/instructions/memory.md)
 */
const memoryCopy: InstructionCompiler<ResolvedMemoryCopyLine> = (line, context, facts) => {
	const operation = getInstructionSpec(line.instruction).effects.memory;
	const destinationIndex = operation.addressOperandIndex;
	const destination = facts.stackAnalysis.consumedOperands[destinationIndex];
	const source = facts.stackAnalysis.consumedOperands[destinationIndex + 1];
	const byteLength = line.arguments[0].value;
	const memoryCopyByteCode = wasmMemoryCopy();

	if (byteLength === 0) {
		return saveByteCode(context, [WASM_DROP, WASM_DROP]);
	}

	const safeRanges = {
		destination: isSafeMemoryAccess(destination, byteLength, context.minimumMemoryBytes),
		source: isSafeMemoryAccess(source, byteLength, context.minimumMemoryBytes),
	};
	if (!context.enableMemoryGuards || (safeRanges.destination && safeRanges.source)) {
		return saveByteCode(context, [...i32const(byteLength), ...memoryCopyByteCode]);
	}

	return saveByteCode(context, guardedMemoryCopy(context, byteLength, safeRanges));
};

export default memoryCopy;
