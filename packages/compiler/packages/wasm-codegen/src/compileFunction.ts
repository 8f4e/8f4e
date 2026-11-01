import {
	createFunction,
	createLocalDeclaration,
	WASM_TYPE_F32,
	WASM_TYPE_F64,
	WASM_TYPE_I32,
} from '@8f4e/compiler-wasm-utils';
import type {
	AssertionCodegenSites,
	CompiledFunction,
	CompileOptions,
	ComposedFunctionAST,
	FunctionTypeRegistry,
	WasmFunctionLayout,
} from '@8f4e/language-spec';

import { BlockType } from '@8f4e/language-spec';
import type { FunctionSemanticReferences } from '@8f4e/semantic-reference-resolver';
import type { StackAnalyzedFunction } from '@8f4e/stack-analyzer';
import { compileCodegenLine } from './compileLine';
import { createCodegenContext } from './createCodegenContext';

/**
 * Compiles one resolved function into a WebAssembly function body or import metadata.
 *
 * @param resolved - Executable body, source bindings, and registered function metadata.
 * @param typeRegistry - Function type registry used for WASM block signatures.
 * @param functionLayout - Final function indices and signatures shared with binary emission.
 * @param stackReport - Stack-analysis report for this function.
 * @param options - Compiler options for this compilation pass.
 * @returns The compiled function artifact.
 */
export function compileFunction(
	resolved: FunctionSemanticReferences<ComposedFunctionAST>,
	typeRegistry: FunctionTypeRegistry,
	functionLayout: WasmFunctionLayout,
	stackReport: StackAnalyzedFunction,
	options: Pick<CompileOptions, 'includeStackAnalysis'> = {},
	assertionCalls?: AssertionCodegenSites
): CompiledFunction {
	const { ast, metadata: functionMetadata, bindings, body } = resolved;
	const context = createCodegenContext(
		{
			functionLayout,
			assertionCalls,
			byteCode: [],
			blockStack: [{ blockType: BlockType.FUNCTION, expectedResultTypes: [] }],
			codeBlockType: 'function',
			projectBlockId: ast.projectBlockId,
			source: ast.source,
			codeBlockId: functionMetadata.name,
			functionTypeRegistry: typeRegistry,
		},
		bindings
	);

	for (const [operationIndex, { line }] of body.entries())
		compileCodegenLine(line, stackReport.operationFacts[operationIndex], context);
	const { wasmIndex, typeIndex } = functionLayout.functions[functionMetadata.id];

	// Collect locals (excluding parameters)
	// Parameters are always at indices 0, 1, 2, ..., (parameterCount - 1)
	// Regular locals declared with the 'local' instruction come after parameters
	const parameterCount = functionMetadata.signature.parameters.length;
	const localDeclarations = Object.entries(context.locals)
		.filter(([, local]) => local.index >= parameterCount)
		.map(([, local]) => ({
			isInteger: local.isInteger,
			isFloat64: local.isFloat64,
			count: 1,
		}));

	return {
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
					context.byteCode
				),
		locals: functionMetadata.import ? [] : localDeclarations,
		...(functionMetadata.exportName ? { exportName: functionMetadata.exportName } : {}),
		...(functionMetadata.import ? { import: functionMetadata.import } : {}),
		wasmIndex,
		typeIndex: typeIndex,
		ast,
		...(stackReport.used ? { used: true } : {}),
		...(functionMetadata.paramShapeExpansions ? { paramShapeExpansions: functionMetadata.paramShapeExpansions } : {}),
		...(options.includeStackAnalysis ? { stackAnalysis: stackReport.stackAnalysis } : {}),
	};
}
