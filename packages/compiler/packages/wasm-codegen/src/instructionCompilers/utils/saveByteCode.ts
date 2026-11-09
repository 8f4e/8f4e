import type { CodegenContext, WasmIRInstruction } from '@8f4e/language-spec';

/**
 * Appends one Wasm instructions fragment to the active code generation context.
 *
 * @param context - Compilation context used by the operation.
 * @param byteCode - Wasm instructions to append to the current output.
 * @returns The computed result.
 */
export function saveByteCode(context: CodegenContext, byteCode: readonly WasmIRInstruction[]): CodegenContext {
	context.instructions.push(...byteCode);
	return context;
}
