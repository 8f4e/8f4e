import {
	createFunction,
	createLocalDeclaration,
	WASM_TYPE_F32,
	WASM_TYPE_F64,
	WASM_TYPE_I32,
} from '@8f4e/compiler-wasm-utils';
import type {
	CompiledModule,
	CompiledStackAnalysisLine,
	ComposedModuleAST,
	FunctionTypeRegistry,
	ReferenceSlotMap,
	WasmFunctionLayout,
	WasmIRBody,
} from '@8f4e/language-spec';

import { emitWasmInstructions } from './emitWasmInstructions';

interface CompileModuleInput {
	ast: ComposedModuleAST;
	referenceSlots: ReferenceSlotMap;
	skipExecutionInCycle: boolean;
	body: WasmIRBody;
	index: number;
	stackAnalysis?: CompiledStackAnalysisLine[];
}

/** Emits one lowered module cycle function and its memory metadata. */
export function compileModule(
	{ ast, referenceSlots, skipExecutionInCycle, body, index, stackAnalysis }: CompileModuleInput,
	functionLayout: WasmFunctionLayout,
	typeRegistry: FunctionTypeRegistry
): CompiledModule {
	return {
		referenceSlots,
		id: ast.id,
		executionEntryName: ast.executionEntryName,
		cycleFunction: createFunction(
			body.locals.map(local => {
				return createLocalDeclaration(
					local.isInteger ? WASM_TYPE_I32 : local.isFloat64 ? WASM_TYPE_F64 : WASM_TYPE_F32,
					1
				);
			}),
			emitWasmInstructions(body.instructions, functionLayout, typeRegistry)
		),
		ast,
		...(stackAnalysis ? { stackAnalysis } : {}),
		index,
		...(skipExecutionInCycle ? { skipExecutionInCycle } : {}),
	};
}
