import { WASM_TYPE_F32, WASM_TYPE_F64, WASM_TYPE_I32 } from '@8f4e/compiler-wasm-utils';
import type { ResolvedMemoryDeclaration } from '@8f4e/language-spec';

/** Scalar kind used by lowering to select concrete Wasm operations. */
export type PushValueKind = 'int32' | 'float32' | 'float64';

/**
 * Resolves the pushed scalar kind for a declared memory item.
 *
 * @param memoryItem - Memory item whose scalar kind should be resolved.
 * @returns The computed result.
 */
export function resolveMemoryValueKind(memoryItem: ResolvedMemoryDeclaration): PushValueKind {
	if (memoryItem.isInteger) return 'int32';
	if (memoryItem.isFloat64) return 'float64';
	return 'float32';
}

/**
 * Resolves the pushed scalar kind for a parsed literal or compile-time argument.
 *
 * @param argument - Argument whose resolved value or metadata should be used.
 * @returns The computed result.
 */
export function resolveArgumentValueKind(argument: { isInteger: boolean; isFloat64?: boolean }): PushValueKind {
	if (argument.isFloat64) return 'float64';
	return argument.isInteger ? 'int32' : 'float32';
}

/**
 * Maps a push scalar kind to its emitted WASM value type.
 *
 * @param kind - Scalar value kind to convert.
 * @returns The computed result.
 */
export function valueKindToWasmType(
	kind: PushValueKind
): typeof WASM_TYPE_I32 | typeof WASM_TYPE_F32 | typeof WASM_TYPE_F64 {
	if (kind === 'float64') {
		return WASM_TYPE_F64;
	}

	return kind === 'float32' ? WASM_TYPE_F32 : WASM_TYPE_I32;
}
