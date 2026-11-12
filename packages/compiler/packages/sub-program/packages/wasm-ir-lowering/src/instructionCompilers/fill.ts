import type { ASTLineBase, InstructionCompiler } from '@8f4e/language-spec';
import { getInstructionSpec } from '@8f4e/language-spec';
import { guardedMemoryFill, isSafeMemoryFill } from './utils/memoryAccessGuard';
import { saveByteCode } from './utils/saveByteCode';

/** Lowers a byte fill, omitting its runtime guard when the linear-memory range is proven safe. */
const fill: InstructionCompiler<ASTLineBase<'fill', []>> = (line, context, facts) => {
	const operation = getInstructionSpec(line.instruction).effects.memory;
	const operands = facts.stackAnalysis.consumedOperands;
	const safe = isSafeMemoryFill(
		operands[operation.addressOperandIndex],
		operands[operation.lengthOperandIndex],
		context.minimumMemoryBytes
	);
	return saveByteCode(
		context,
		!context.enableMemoryGuards || safe ? [{ kind: 'memory.fill' }] : guardedMemoryFill(context)
	);
};

export default fill;
