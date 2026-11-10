import { WASM_TYPE_I32 } from '@8f4e/compiler-wasm-utils';
import type { FunctionTypeSignature, WasmIR, WasmIRFunction } from '@8f4e/language-spec';
import { expect, it } from 'vitest';
import { emitWasmProgram } from './emitWasmProgram';

it('resolves function and data references in a complete module', async () => {
	const signature: FunctionTypeSignature = { params: [], results: [WASM_TYPE_I32] };
	const ir: WasmIR = {
		functions: new Map<string, WasmIRFunction>([
			[
				'run',
				{
					signature,
					body: {
						locals: [],
						instructions: [
							{ kind: 'i32.const', value: 4 },
							{ kind: 'i32.const', value: 0 },
							{ kind: 'i32.const', value: 2 },
							{ kind: 'memory.init', dataSegmentId: 'defaults' },
							{ kind: 'call', targetFunctionId: 'read' },
						],
					},
				},
			],
			['read', { signature, import: { moduleName: 'host', fieldName: 'read' } }],
		]),
		exports: new Map([['run', 'run']]),
		memory: { moduleName: 'host', fieldName: 'memory', minPages: 1, maxPages: 1 },
		dataSegments: new Map([
			['other', Uint8Array.of(99)],
			['defaults', Uint8Array.of(7, 11)],
		]),
	};
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
	const bytes = new Uint8Array(memory.buffer);
	const codeBuffer = emitWasmProgram(ir);
	const { instance } = await WebAssembly.instantiate(new Uint8Array(codeBuffer), {
		host: { memory, read: () => bytes[4] + bytes[5] },
	});
	expect((instance.exports.run as () => number)()).toBe(18);
});
