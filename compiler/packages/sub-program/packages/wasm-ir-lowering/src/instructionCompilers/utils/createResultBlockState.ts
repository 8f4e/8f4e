import type { WasmTypeValue } from '@8f4e/compiler-wasm-utils';
import { WASM_TYPE_F32, WASM_TYPE_I32 } from '@8f4e/compiler-wasm-utils';
import type { BlockResultTypes, BlockStack, BlockType } from '@8f4e/language-spec';

type ResultBlockType = typeof BlockType.BLOCK | typeof BlockType.CONDITION;

interface ResultBlockState<TBlockType extends ResultBlockType> {
	blockState: Extract<BlockStack[number], { blockType: TBlockType }>;
	wasmBlockType: WasmTypeValue[];
}

function resultTypeToWasmType(resultType: BlockResultTypes[number]): WasmTypeValue {
	return resultType === 'float' ? WASM_TYPE_F32 : WASM_TYPE_I32;
}

/**
 * Creates the compiler block-stack metadata and matching WASM block result type.
 *
 * @param resultTypes - Result types expected from the block.
 * @param blockType - Compiler block type to inspect.
 * @returns Created result block state.
 */
export default function createResultBlockState<TBlockType extends ResultBlockType>(
	resultTypes: BlockResultTypes,
	blockType: TBlockType
): ResultBlockState<TBlockType> {
	return {
		blockState: { expectedResultTypes: resultTypes, blockType } as Extract<
			BlockStack[number],
			{ blockType: TBlockType }
		>,
		wasmBlockType: resultTypes.map(resultTypeToWasmType),
	};
}
