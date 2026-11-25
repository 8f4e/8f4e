import type { ASTLineBase, InstructionCompiler } from '@8f4e/language-spec';
import { getInstructionSpec } from '@8f4e/language-spec';
import { guardedMemoryFill, isSafeMemoryAccess } from './utils/memoryAccessGuard';
import { saveByteCode } from './utils/saveByteCode';

/** Lowers a byte fill, omitting its runtime guard when the linear-memory range is proven safe. */
const fill: InstructionCompiler<ASTLineBase<'fill', []>> = (line, context, facts) => {
	const operation = getInstructionSpec(line.instruction).effects.memory;
	const operands = facts.stackAnalysis.consumedOperands;
	const length = operands[operation.lengthOperandIndex].knownValue;
	const safe =
		length !== undefined &&
		isSafeMemoryAccess(operands[operation.addressOperandIndex], length, context.minimumMemoryBytes);
	return saveByteCode(
		context,
		!context.enableMemoryGuards || safe ? [{ kind: 'memory.fill' }] : guardedMemoryFill(context)
	);
};

export default fill;
