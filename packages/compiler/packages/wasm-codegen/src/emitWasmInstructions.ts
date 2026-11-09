import { call, localGet, localSet, signedLEB128 } from '@8f4e/compiler-wasm-utils';
import type { FunctionTypeRegistry, WasmFunctionLayout, WasmIRInstruction } from '@8f4e/language-spec';
import { getOrRegisterFunctionType } from './functionTypeRegistry';

/** Encodes lowered instructions using the final body-local bindings and function layout. */
export function emitWasmInstructions(
	instructions: readonly WasmIRInstruction[],
	functionLayout: WasmFunctionLayout,
	typeRegistry: FunctionTypeRegistry
): number[] {
	const bytes: number[] = [];
	for (const instruction of instructions) {
		if (typeof instruction === 'number') {
			bytes.push(instruction);
			continue;
		}
		switch (instruction.kind) {
			case 'local.get':
				bytes.push(...localGet(instruction.binding));
				break;
			case 'local.set':
				bytes.push(...localSet(instruction.binding));
				break;
			case 'call':
				bytes.push(...call(functionLayout.functions[instruction.targetFunctionId].wasmIndex));
				break;
			case 'assertionCall':
				bytes.push(...call(functionLayout.assertionCallbacks.get(instruction.fieldName)!));
				break;
			case 'blockType':
				bytes.push(
					...signedLEB128(getOrRegisterFunctionType(typeRegistry, { params: [], results: instruction.results }))
				);
				break;
		}
	}
	return bytes;
}
