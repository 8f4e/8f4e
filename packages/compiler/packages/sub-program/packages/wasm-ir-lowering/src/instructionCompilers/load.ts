import { WASM_TYPE_I32 } from '@8f4e/compiler-wasm-utils';
import type {
	ASTLineBase,
	InstructionCompiler,
	LoadInstructionSpecName,
	MemoryLoadVariant,
	WasmIRInstruction,
} from '@8f4e/language-spec';
import { getInstructionSpec } from '@8f4e/language-spec';
import { f32load, i32load, i32load8s, i32load8u, i32load16s, i32load16u } from '../operations';
import { guardedLoad, isSafeMemoryAccess } from './utils/memoryAccessGuard';
import { saveByteCode } from './utils/saveByteCode';

type LoadLine = ASTLineBase<LoadInstructionSpecName, []>;

/**
 * Instruction compiler for `load` variants.
 * @see [Instruction docs](../../docs/instructions/memory.md)
 */
const loadVariantByteCode: Record<MemoryLoadVariant, WasmIRInstruction[]> = {
	i32: i32load(2, 0),
	i32_8s: i32load8s(0, 0),
	i32_8u: i32load8u(0, 0),
	i32_16s: i32load16s(1, 0),
	i32_16u: i32load16u(1, 0),
	f32: f32load(2, 0),
};

const load: InstructionCompiler<LoadLine> = (line, context, facts) => {
	const [rawAddress] = facts.stackAnalysis.consumedOperands;
	const address = rawAddress;
	const operation = getInstructionSpec(line.instruction).effects.memory;
	const instructions = loadVariantByteCode[operation.loadVariant];
	const accessByteWidth = operation.accessByteWidth;
	if (isSafeMemoryAccess(address, accessByteWidth)) {
		return saveByteCode(context, instructions);
	}

	return saveByteCode(
		context,
		guardedLoad(context, {
			accessByteWidth,
			resultType: WASM_TYPE_I32,
			loadByteCode: instructions,
		})
	);
};

export default load;
