import {
	createFunction,
	createLocalDeclaration,
	WASM_TYPE_F32,
	WASM_TYPE_F64,
	WASM_TYPE_I32,
} from '@8f4e/compiler-wasm-utils';
import type {
	CompiledFunction,
	CompiledStackAnalysisLine,
	ComposedFunctionAST,
	FunctionAnalysis,
	FunctionMetadata,
	FunctionTypeRegistry,
	WasmFunctionLayout,
	WasmIRBody,
} from '@8f4e/language-spec';

import { emitWasmInstructions } from './emitWasmInstructions';

interface CompileFunctionInput {
	ast: ComposedFunctionAST;
	metadata: FunctionMetadata;
	body: WasmIRBody;
	analysis: FunctionAnalysis;
	stackAnalysis?: CompiledStackAnalysisLine[];
}

/** Emits one lowered function body and its source metadata. */
export function compileFunction(
	{ ast, metadata, body, analysis, stackAnalysis }: CompileFunctionInput,
	functionLayout: WasmFunctionLayout,
	typeRegistry: FunctionTypeRegistry
): CompiledFunction {
	const { wasmIndex, typeIndex } = functionLayout.functions[metadata.id];
	const localDeclarations = body.locals.slice(body.parameterCount).map(local => ({
		isInteger: local.isInteger,
		isFloat64: local.isFloat64,
		count: 1,
	}));

	return {
		analysis,
		id: metadata.id,
		name: metadata.name,
		signature: metadata.signature,
		body: metadata.import
			? []
			: createFunction(
					localDeclarations.map(local =>
						createLocalDeclaration(
							local.isInteger ? WASM_TYPE_I32 : local.isFloat64 ? WASM_TYPE_F64 : WASM_TYPE_F32,
							local.count
						)
					),
					emitWasmInstructions(body.instructions, functionLayout, typeRegistry)
				),
		locals: metadata.import ? [] : localDeclarations,
		...(metadata.exportName ? { exportName: metadata.exportName } : {}),
		...(metadata.import ? { import: metadata.import } : {}),
		wasmIndex,
		typeIndex: typeIndex,
		ast,
		...(metadata.paramShapeExpansions ? { paramShapeExpansions: metadata.paramShapeExpansions } : {}),
		...(stackAnalysis ? { stackAnalysis } : {}),
	};
}
