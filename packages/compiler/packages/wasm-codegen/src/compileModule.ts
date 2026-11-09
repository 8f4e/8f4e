import {
	createFunction,
	createLocalDeclaration,
	WASM_TYPE_F32,
	WASM_TYPE_F64,
	WASM_TYPE_I32,
} from '@8f4e/compiler-wasm-utils';
import type {
	CompiledModule,
	CompileOptions,
	ComposedModuleAST,
	FunctionTypeRegistry,
	WasmFunctionLayout,
	WasmIRBody,
} from '@8f4e/language-spec';

import type { ModuleSemanticReferences } from '@8f4e/semantic-reference-resolver';
import type { StackAnalyzedModule } from '@8f4e/stack-analyzer';
import { emitWasmInstructions } from './emitWasmInstructions';

/**
 * Emits one lowered module cycle function and its memory metadata.
 *
 * @param resolved - Module metadata and source AST.
 * @param body - Lowered Wasm instructions and bindings.
 * @param index - WASM index or source index assigned to the compiled item.
 * @param functionLayout - Final function indices shared with binary emission.
 * @param options - Compiler options for this compilation pass.
 * @param typeRegistry - Function type registry used for WASM block signatures.
 * @param stackReport - Stack-analysis report for this module.
 * @returns The compiled module artifact.
 */
export function compileModule(
	resolved: ModuleSemanticReferences<ComposedModuleAST>,
	body: WasmIRBody,
	index: number,
	functionLayout: WasmFunctionLayout,
	stackReport: StackAnalyzedModule,
	options: Pick<CompileOptions, 'includeStackAnalysis'>,
	typeRegistry: FunctionTypeRegistry
): CompiledModule {
	const { ast } = resolved;
	return {
		referenceSlots: resolved.referenceSlots,
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
		...(options.includeStackAnalysis ? { stackAnalysis: stackReport.stackAnalysis } : {}),
		index,
		...(resolved.skipExecutionInCycle ? { skipExecutionInCycle: true } : {}),
	};
}
