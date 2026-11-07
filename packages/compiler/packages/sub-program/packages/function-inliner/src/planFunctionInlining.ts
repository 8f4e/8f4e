import type { FunctionAnalysisReport } from '@8f4e/function-analyzer';
import type {
	AST,
	AssertionCodegenSites,
	FunctionInlineCalls,
	FunctionInliningOptions,
	FunctionInliningPlan,
	InlineFunctionBody,
	StackAnalysisLineFacts,
} from '@8f4e/language-spec';
import type { SemanticReferenceReport } from '@8f4e/semantic-reference-resolver';
import type { StackAnalysisSubProgramReport } from '@8f4e/stack-analyzer';

export interface PlanFunctionInliningInput {
	semanticReferences: SemanticReferenceReport;
	stackReport: StackAnalysisSubProgramReport;
	functionAnalysis: FunctionAnalysisReport;
	assertionCalls?: ReadonlyMap<AST, AssertionCodegenSites>;
}

export const DEFAULT_INLINING_OPTIONS: Required<FunctionInliningOptions> = {
	maxCalleeOperations: 32,
	maxCallerOperations: 1_024,
};

/** Chooses bounded, single-level expansions while retaining source bodies, analysis facts, and standalone definitions. */
export function planFunctionInlining(
	{ semanticReferences, stackReport, functionAnalysis, assertionCalls }: PlanFunctionInliningInput,
	options: FunctionInliningOptions = {}
): FunctionInliningPlan {
	const limits = { ...DEFAULT_INLINING_OPTIONS, ...options };
	const callees = new Map<string, InlineFunctionBody>();
	for (const { ast, metadata, body, bindings } of Object.values(semanticReferences.functions)) {
		const analysis = functionAnalysis.functions[metadata.id];
		if (analysis.isImported || analysis.isRecursive || analysis.hasEarlyReturn) continue;
		const operations = analysis.hasExplicitReturn ? body.slice(0, -1) : body;
		if (operations.length > limits.maxCalleeOperations) continue;
		callees.set(metadata.id, {
			id: metadata.id,
			signature: metadata.signature,
			bindings,
			operations: operations.map(({ line }, index) => ({
				line,
				facts: stackReport.functions[metadata.id].operationFacts[index],
			})),
			diagnosticContext: {
				codeBlockId: metadata.name,
				codeBlockType: 'function',
				projectBlockId: ast.projectBlockId,
				source: ast.source,
			},
			assertionCalls: assertionCalls?.get(ast),
		});
	}
	function selectCalls(facts: readonly StackAnalysisLineFacts[]): FunctionInlineCalls {
		const calls = new Map<number, InlineFunctionBody>();
		let size = facts.length;
		for (const [index, fact] of facts.entries()) {
			const callee = fact.targetFunctionId === undefined ? undefined : callees.get(fact.targetFunctionId);
			if (!callee) continue;
			// One local.set per parameter, const/local.set per source local, and a result block/end.
			const overhead = callee.bindings.reduce(
				(count, binding) => count + (binding.parameterIndex === undefined ? 2 : 1),
				2
			);
			const expandedSize = size - 1 + callee.operations.length + overhead;
			if (expandedSize > limits.maxCallerOperations) continue;
			calls.set(index, callee);
			size = expandedSize;
		}
		return calls;
	}
	return {
		functions: Object.fromEntries(
			Object.entries(stackReport.functions).map(([id, report]) => [id, selectCalls(report.operationFacts)])
		),
		modules: Object.fromEntries(
			Object.entries(stackReport.modules).map(([id, report]) => [id, selectCalls(report.operationFacts)])
		),
	};
}
