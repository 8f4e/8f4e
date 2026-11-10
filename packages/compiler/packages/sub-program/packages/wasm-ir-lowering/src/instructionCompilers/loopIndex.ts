import { WASM_I32_SUB } from '@8f4e/compiler-wasm-utils';
import type { InstructionCompiler, LoopIndexLine } from '@8f4e/language-spec';
import { wasmLocalGet as localGet } from '@8f4e/language-spec';
import { i32const } from '../operations';

import { saveByteCode } from './utils/saveByteCode';

const loopIndex: InstructionCompiler<LoopIndexLine> = (_line, context) => {
	const { loopCounterIndex } = context.activeLoopBlocks[context.activeLoopBlocks.length - 1];

	return saveByteCode(context, [...localGet(loopCounterIndex), ...i32const(1), WASM_I32_SUB]);
};

export default loopIndex;
