import type {
	AssertionCodegenSites,
	ComposedAST,
	ComposedFunctionAST,
	ComposedModuleAST,
	StackAnalysisLineFacts,
	WasmIR,
	WasmIRBody,
} from '@8f4e/language-spec';
import { BlockType } from '@8f4e/language-spec';
import type {
	FunctionSemanticReferences,
	ModuleSemanticReferences,
	SemanticReferenceReport,
} from '@8f4e/semantic-reference-resolver';
import type { StackAnalysisSubProgramReport } from '@8f4e/stack-analyzer';
import { compileCodegenLine } from './compileLine';
import { createCodegenContext } from './createCodegenContext';

function lowerBody(
	resolved: FunctionSemanticReferences | ModuleSemanticReferences,
	facts: readonly StackAnalysisLineFacts[],
	assertions?: AssertionCodegenSites
): WasmIRBody {
	const { ast, bindings, body } = resolved;
	const blockType = 'metadata' in resolved ? BlockType.FUNCTION : BlockType.MODULE;
	const context = createCodegenContext(
		{
			blockStack: [{ blockType, expectedResultTypes: [] }],
			codeBlockType: ast.type,
			codeBlockId: 'metadata' in resolved ? resolved.metadata.name : resolved.ast.id,
			projectBlockId: ast.projectBlockId,
			source: ast.source,
		},
		bindings
	);

	for (const [index, { line }] of body.entries()) {
		compileCodegenLine(line, facts[index], context, assertions?.get(index));
	}
	return {
		instructions: context.instructions,
		locals: context.locals,
		parameterCount: 'metadata' in resolved ? resolved.metadata.signature.parameters.length : 0,
		sourceBindingCount: bindings.length,
	};
}

/** Lowers resolved operations once, leaving all locals and references explicit before index assignment. */
export function lowerToWasmIR(
	references: SemanticReferenceReport<ComposedModuleAST, ComposedFunctionAST>,
	stackReport: StackAnalysisSubProgramReport,
	assertionCalls?: ReadonlyMap<ComposedAST, AssertionCodegenSites>
): WasmIR {
	return {
		modules: Object.fromEntries(
			Object.entries(references.modules).map(([id, resolved]) => [
				id,
				lowerBody(resolved, stackReport.modules[id].operationFacts, assertionCalls?.get(resolved.ast)),
			])
		),
		functions: Object.fromEntries(
			Object.entries(references.functions).map(([id, resolved]) => [
				id,
				lowerBody(resolved, stackReport.functions[id].operationFacts, assertionCalls?.get(resolved.ast)),
			])
		),
	};
}
