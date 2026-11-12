import type { ASTLineBase, InstructionCompiler } from '@8f4e/language-spec';
import { guardedMemoryFill } from './utils/memoryAccessGuard';
import { saveByteCode } from './utils/saveByteCode';

/** Lowers a byte fill to WebAssembly memory.fill, guarding the entire runtime-sized range. */
const fill: InstructionCompiler<ASTLineBase<'fill', []>> = (_line, context) => {
	return saveByteCode(context, context.enableMemoryGuards ? guardedMemoryFill(context) : [{ kind: 'memory.fill' }]);
};

export default fill;
