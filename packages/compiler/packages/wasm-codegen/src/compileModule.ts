import {
	createFunction,
	createLocalDeclaration,
	WASM_TYPE_F32,
	WASM_TYPE_F64,
	WASM_TYPE_I32,
} from '@8f4e/compiler-wasm-utils';
import type {
	AssertionCodegenSites,
	CompiledModule,
	CompileOptions,
	ComposedModuleAST,
	FunctionTypeRegistry,
	WasmFunctionLayout,
} from '@8f4e/language-spec';

import { BlockType } from '@8f4e/language-spec';
import type { ModuleSemanticReferences } from '@8f4e/semantic-reference-resolver';
import type { StackAnalyzedModule } from '@8f4e/stack-analyzer';
import { compileCodegenLine } from './compileLine';
import { createCodegenContext } from './createCodegenContext';

/**
 * Compiles one resolved module into its WebAssembly cycle function and memory metadata.
 *
 * @param resolved - Executable body, source bindings, and module metadata.
 * @param index - WASM index or source index assigned to the compiled item.
 * @param functionLayout - Final function indices shared with binary emission.
 * @param options - Compiler options for this compilation pass.
 * @param typeRegistry - Function type registry used for WASM block signatures.
 * @param stackReport - Stack-analysis report for this module.
 * @returns The compiled module artifact.
 */
export function compileModule(
	resolved: ModuleSemanticReferences<ComposedModuleAST>,
	index: number,
	functionLayout: WasmFunctionLayout,
	stackReport: StackAnalyzedModule,
	options: Pick<CompileOptions, 'includeStackAnalysis'> = {},
	typeRegistry?: FunctionTypeRegistry,
	assertionCalls?: AssertionCodegenSites
): CompiledModule {
	const { ast, bindings, body } = resolved;
	const context = createCodegenContext(
		{
			functionLayout,
			assertionCalls,
			byteCode: [],
			blockStack: [{ blockType: BlockType.MODULE, expectedResultTypes: [] }],
			functionTypeRegistry: typeRegistry,
			codeBlockId: ast.id,
			codeBlockType: 'module',
			projectBlockId: ast.projectBlockId,
			source: ast.source,
		},
		bindings
	);

	for (const [operationIndex, { line }] of body.entries())
		compileCodegenLine(line, stackReport.operationFacts[operationIndex], context);

	return {
		id: ast.id,
		cycleFunction: createFunction(
			Object.values(context.locals).map(local => {
				return createLocalDeclaration(
					local.isInteger ? WASM_TYPE_I32 : local.isFloat64 ? WASM_TYPE_F64 : WASM_TYPE_F32,
					1
				);
			}),
			context.byteCode
		),
		ast,
		...(options.includeStackAnalysis ? { stackAnalysis: stackReport.stackAnalysis } : {}),
		index,
		...(resolved.skipExecutionInCycle ? { skipExecutionInCycle: true } : {}),
	};
}
