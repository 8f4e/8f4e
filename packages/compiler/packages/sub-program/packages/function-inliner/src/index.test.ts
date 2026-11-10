import { WASM_DROP } from '@8f4e/compiler-wasm-utils';
import type { WasmIR, WasmIRFunction, WasmIRInstruction } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { inlineFunctions } from '.';

const call = (targetFunctionId: string): WasmIRInstruction => ({ kind: 'call', targetFunctionId });
const scalarOperation: WasmIRInstruction[] = [{ kind: 'i32.const', value: 7 }, WASM_DROP];

function definition(instructions: readonly WasmIRInstruction[]): WasmIRFunction {
	return { signature: { params: [], results: [] }, body: { instructions, locals: [] } };
}

function createInput(functions: Array<[string, WasmIRFunction]>): WasmIR {
	return {
		functions: new Map(functions),
		exports: new Map([['run', 'caller']]),
		memory: { moduleName: 'host', fieldName: 'memory', minPages: 1, maxPages: 1 },
		dataSegments: new Map(),
	};
}

describe('inlineFunctions', () => {
	it('bounds caller growth across rounds and preserves a still-referenced body', () => {
		const leaf = definition(scalarOperation);
		const caller = definition(Array<WasmIRInstruction>(65).fill(call('leaf')));
		const ir = createInput([
			['caller', caller],
			['leaf', leaf],
		]);
		const result = inlineFunctions(ir, { maxCallerGrowth: 64 });
		const instructions = result.functions.get('caller')!.body!.instructions;

		expect(instructions).toHaveLength(64 * scalarOperation.length + 1);
		expect(instructions.at(-1)).toEqual(call('leaf'));
		expect(instructions.slice(0, scalarOperation.length)).toEqual(scalarOperation);
		expect(ir.functions.get('caller')).toBe(caller);
		expect(result.functions.get('leaf')).toBe(leaf);
		expect(inlineFunctions(ir).functions.has('leaf')).toBe(false);
	});

	it('applies an expansion limit to a callee with one call site', () => {
		const ir = createInput([
			['caller', definition([call('leaf')])],
			['leaf', definition(scalarOperation)],
		]);
		expect(inlineFunctions(ir, { maxExpansionOperations: 1 })).toBe(ir);
		expect(inlineFunctions(ir).functions.get('caller')!.body!.instructions).toEqual(scalarOperation);
	});

	it('retains a call cycle through otherwise single-use bodies', () => {
		const ir = createInput([
			['caller', definition([call('a')])],
			['a', definition([call('b')])],
			['b', definition([call('caller')])],
		]);
		expect(inlineFunctions(ir)).toBe(ir);
	});
});
