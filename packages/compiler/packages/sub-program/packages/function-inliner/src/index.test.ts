import { WASM_DROP, WASM_I32_CONST } from '@8f4e/compiler-wasm-utils';
import type { FunctionAnalysisReport } from '@8f4e/function-analyzer';
import type { WasmIR, WasmIRBody, WasmIRInstruction } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { inlineFunctions } from '.';

const call: WasmIRInstruction = { kind: 'call', targetFunctionId: 'leaf' };
const scalarOperation = [WASM_I32_CONST, 7, WASM_DROP];
const analysis = { isImported: false, isRecursive: false, hasExplicitReturn: false, hasEarlyReturn: false };
const scalarTypes = { hasPointerBindings: false, hasPointerReturns: false };

function createInput(operationPairs: number, callCount: number) {
	const leaf: WasmIRBody = {
		instructions: Array.from({ length: operationPairs }, () => scalarOperation).flat(),
		locals: [],
		parameterCount: 0,
		sourceBindingCount: 0,
	};
	const caller: WasmIRBody = {
		instructions: Array<WasmIRInstruction>(callCount).fill(call),
		locals: [],
		parameterCount: 0,
		sourceBindingCount: 0,
	};
	const ir: WasmIR = { modules: {}, functions: { leaf, caller } };
	const functionAnalysis: FunctionAnalysisReport = {
		functions: {
			leaf: {
				analysis,
				bodyFacts: {
					operationCount: operationPairs * 2,
					instructionKinds: ['push', 'drop'],
					pushOperandKinds: ['literal'],
					...scalarTypes,
				},
			},
			caller: {
				analysis,
				bodyFacts: {
					operationCount: callCount,
					instructionKinds: ['call'],
					pushOperandKinds: [],
					...scalarTypes,
				},
			},
		},
	};
	return { ir, functionAnalysis };
}

describe('inlineFunctions', () => {
	it('bounds caller growth and keeps the input bodies intact', () => {
		const { ir, functionAnalysis } = createInput(1, 65);
		const result = inlineFunctions(ir, functionAnalysis, { maxCallerGrowth: 64 });
		const caller = result.functions.caller;

		expect(caller.instructions).toHaveLength(64 * scalarOperation.length + 1);
		expect(caller.instructions.at(-1)).toBe(call);
		expect(caller.instructions.slice(0, scalarOperation.length)).toEqual(scalarOperation);
		expect(ir.functions.caller.instructions).toHaveLength(65);
		expect(result.functions.leaf).toBe(ir.functions.leaf);
		expect(inlineFunctions(ir, functionAnalysis).functions.caller.instructions).toHaveLength(
			65 * scalarOperation.length
		);
	});

	it('applies an expansion limit when configured', () => {
		const { ir, functionAnalysis } = createInput(7, 1);
		expect(inlineFunctions(ir, functionAnalysis, { maxExpansionOperations: 12 })).toBe(ir);
		expect(inlineFunctions(ir, functionAnalysis).functions.caller.instructions).toEqual(ir.functions.leaf.instructions);
	});
});
