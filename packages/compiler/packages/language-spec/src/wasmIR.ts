import type { WasmTypeValue } from '@8f4e/compiler-wasm-utils';
import type { FunctionTypeSignature } from './compiled';
import type { FunctionImportMetadata } from './functionTypes';

/** Wasm operations with unencoded operands. A number denotes an opcode without immediates. */
export type WasmIRInstruction =
	| number
	| { kind: 'i32.const' | 'f32.const' | 'f64.const'; value: number }
	| { kind: 'local.get' | 'local.set'; binding: number }
	| { kind: 'call'; targetFunctionId: string }
	| { kind: 'block'; opcode: number; results: WasmTypeValue[] }
	| { kind: 'branch'; opcode: number; depth: number }
	| { kind: 'memoryAccess'; opcode: number; alignment: number; offset: number }
	| { kind: 'prefixed'; prefix: number; opcode: number }
	| { kind: 'memory.size' | 'memory.copy' | 'memory.fill' }
	| { kind: 'memory.init'; dataSegmentId: string };

export interface WasmIRBody {
	readonly instructions: readonly WasmIRInstruction[];
	/** Body-relative bindings, including parameters in signature order. */
	readonly locals: readonly WasmTypeValue[];
}

export type WasmIRFunction = { readonly signature: FunctionTypeSignature } & (
	| { readonly body: WasmIRBody; readonly import?: never }
	| { readonly import: FunctionImportMetadata; readonly body?: never }
);

/** Complete module before assigning function, type, or data segment indices. */
export interface WasmIR {
	readonly functions: ReadonlyMap<string, WasmIRFunction>;
	readonly exports: ReadonlyMap<string, string>;
	readonly memory: FunctionImportMetadata & { readonly minPages: number; readonly maxPages: number };
	readonly dataSegments: ReadonlyMap<string, Uint8Array>;
}

export function wasmLocalGet(binding: number): WasmIRInstruction[] {
	return [{ kind: 'local.get', binding }];
}

export function wasmLocalSet(binding: number): WasmIRInstruction[] {
	return [{ kind: 'local.set', binding }];
}

/** Reserved symbolic ID for an assertion callback in the Wasm function table. */
export function assertionFunctionId(fieldName: string): string {
	return `\0assertion:${fieldName}`;
}
