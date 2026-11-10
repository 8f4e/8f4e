import {
	call,
	f32const,
	f64const,
	i32const,
	localGet,
	localSet,
	memoryCopy,
	memoryFill,
	memoryInit,
	prefixedInstruction,
	signedLEB128,
	unsignedLEB128,
	WASM_MEMORY_SIZE,
	WASM_TYPE_VOID,
} from '@8f4e/compiler-wasm-utils';
import type { FunctionTypeRegistry, WasmIRInstruction } from '@8f4e/language-spec';
import { getOrRegisterFunctionType } from './functionTypeRegistry';

/** Encodes the operations and resolves their symbolic references. */
export function emitWasmInstructions(
	instructions: readonly WasmIRInstruction[],
	functionIndices: ReadonlyMap<string, number>,
	dataIndices: ReadonlyMap<string, number>,
	typeRegistry: FunctionTypeRegistry
): number[] {
	const bytes: number[] = [];
	for (const instruction of instructions) {
		if (typeof instruction === 'number') {
			bytes.push(instruction);
			continue;
		}
		switch (instruction.kind) {
			case 'i32.const':
				bytes.push(...i32const(instruction.value));
				break;
			case 'f32.const':
				bytes.push(...f32const(instruction.value));
				break;
			case 'f64.const':
				bytes.push(...f64const(instruction.value));
				break;
			case 'local.get':
				bytes.push(...localGet(instruction.binding));
				break;
			case 'local.set':
				bytes.push(...localSet(instruction.binding));
				break;
			case 'call':
				bytes.push(...call(functionIndices.get(instruction.targetFunctionId)!));
				break;
			case 'block': {
				const { results } = instruction;
				bytes.push(instruction.opcode);
				if (results.length <= 1) bytes.push(results[0] ?? WASM_TYPE_VOID);
				else bytes.push(...signedLEB128(getOrRegisterFunctionType(typeRegistry, { params: [], results })));
				break;
			}
			case 'branch':
				bytes.push(instruction.opcode, ...unsignedLEB128(instruction.depth));
				break;
			case 'memoryAccess':
				bytes.push(instruction.opcode, ...unsignedLEB128(instruction.alignment), ...unsignedLEB128(instruction.offset));
				break;
			case 'prefixed':
				bytes.push(...prefixedInstruction(instruction.prefix, instruction.opcode));
				break;
			case 'memory.size':
				bytes.push(WASM_MEMORY_SIZE, 0);
				break;
			case 'memory.copy':
				bytes.push(...memoryCopy());
				break;
			case 'memory.fill':
				bytes.push(...memoryFill());
				break;
			case 'memory.init':
				bytes.push(...memoryInit(dataIndices.get(instruction.dataSegmentId)!));
				break;
		}
	}
	return bytes;
}
