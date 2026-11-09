import {
	createFunction,
	createLocalDeclaration,
	WASM_TYPE_F32,
	WASM_TYPE_F64,
	WASM_TYPE_I32,
} from '@8f4e/compiler-wasm-utils';
import type {
	CompiledFunction,
	CompileOptions,
	ComposedFunctionAST,
	FunctionAnalysis,
	FunctionTypeRegistry,
	WasmFunctionLayout,
	WasmIRBody,
} from '@8f4e/language-spec';

import type { FunctionSemanticReferences } from '@8f4e/semantic-reference-resolver';
import type { StackAnalyzedFunction } from '@8f4e/stack-analyzer';
import { emitWasmInstructions } from './emitWasmInstructions';

/**
 * Compiles one resolved function into a WebAssembly function body or import metadata.
 *
 * @param resolved - Registered function metadata and source AST.
 * @param body - Lowered Wasm instructions and bindings.
 * @param typeRegistry - Function type registry used for WASM block signatures.
 * @param functionLayout - Final function indices and signatures shared with binary emission.
 * @param stackReport - Stack-analysis report for this function.
 * @param analysis - Structural function facts passed through to compiled output.
 * @param options - Compiler options for this compilation pass.
 * @returns The compiled function artifact.
 */
export function compileFunction(
	resolved: FunctionSemanticReferences<ComposedFunctionAST>,
	body: WasmIRBody,
	typeRegistry: FunctionTypeRegistry,
	functionLayout: WasmFunctionLayout,
	stackReport: StackAnalyzedFunction,
	analysis: FunctionAnalysis,
	options: Pick<CompileOptions, 'includeStackAnalysis'> = {}
): CompiledFunction {
	const { ast, metadata: functionMetadata } = resolved;
	const { wasmIndex, typeIndex } = functionLayout.functions[functionMetadata.id];
	const localDeclarations = body.locals.slice(body.parameterCount).map(local => ({
		isInteger: local.isInteger,
		isFloat64: local.isFloat64,
		count: 1,
	}));

	return {
		analysis,
		id: functionMetadata.id,
		name: functionMetadata.name,
		signature: functionMetadata.signature,
		body: functionMetadata.import
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
		locals: functionMetadata.import ? [] : localDeclarations,
		...(functionMetadata.exportName ? { exportName: functionMetadata.exportName } : {}),
		...(functionMetadata.import ? { import: functionMetadata.import } : {}),
		wasmIndex,
		typeIndex: typeIndex,
		ast,
		...(functionMetadata.paramShapeExpansions ? { paramShapeExpansions: functionMetadata.paramShapeExpansions } : {}),
		...(options.includeStackAnalysis ? { stackAnalysis: stackReport.stackAnalysis } : {}),
	};
}
