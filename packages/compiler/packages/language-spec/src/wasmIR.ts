import type { WasmTypeValue } from '@8f4e/compiler-wasm-utils';
import type { AssertionImportName } from './assertions';
import type { LocalValueMetadata } from './semantic';

/** Fixed Wasm bytes interleaved with instructions and operands that still need index assignment. */
export type WasmIRInstruction =
	| number
	| { kind: 'local.get' | 'local.set'; binding: number }
	| { kind: 'call'; targetFunctionId: string }
	| { kind: 'assertionCall'; fieldName: AssertionImportName }
	| { kind: 'blockType'; results: WasmTypeValue[] };

export interface WasmIRBody {
	readonly instructions: readonly WasmIRInstruction[];
	/** Body-relative bindings, ordered as parameters, declared locals, then lowering temporaries. */
	readonly locals: readonly LocalValueMetadata[];
	readonly parameterCount: number;
	readonly sourceBindingCount: number;
}

export interface WasmIR {
	readonly modules: Readonly<Record<string, WasmIRBody>>;
	readonly functions: Readonly<Record<string, WasmIRBody>>;
}

export function wasmLocalGet(binding: number): WasmIRInstruction[] {
	return [{ kind: 'local.get', binding }];
}

export function wasmLocalSet(binding: number): WasmIRInstruction[] {
	return [{ kind: 'local.set', binding }];
}
