import type { ComposedEntry, FunctionAnalysis, StackAnalysisLineFacts } from '@8f4e/language-spec';
import { createFunctionId } from '@8f4e/language-spec';
import type { SemanticReferenceReport } from '@8f4e/semantic-reference-resolver';
import type { StackAnalysisSubProgramReport } from '@8f4e/stack-analyzer';
import { findRecursiveNodes } from './callGraph';

export interface AnalyzeFunctionsInput {
	semanticReferences: SemanticReferenceReport;
	stackReport: StackAnalysisSubProgramReport;
	entries: readonly ComposedEntry[];
}

/** Structural facts keyed by the canonical identity of each source function overload. */
export interface FunctionAnalysisReport {
	functions: Record<string, FunctionAnalysis>;
}

/** Reports function facts after overload resolution, without choosing or performing optimizations. */
export function analyzeFunctions({
	semanticReferences,
	stackReport,
	entries,
}: AnalyzeFunctionsInput): FunctionAnalysisReport {
	const edges = new Map<string, string[]>();
	const functionKey = (id: string) => `function:${id}`;
	const moduleKey = (id: string) => `module:${id}`;
	const calls = (facts: readonly StackAnalysisLineFacts[]) =>
		facts.flatMap(fact => (fact.targetFunctionId === undefined ? [] : [functionKey(fact.targetFunctionId)]));
	for (const [id, report] of Object.entries(stackReport.functions)) {
		edges.set(functionKey(id), calls(report.operationFacts));
	}
	for (const [id, report] of Object.entries(stackReport.modules)) {
		edges.set(moduleKey(id), calls(report.operationFacts));
	}
	for (const entry of entries) {
		edges.set(
			functionKey(createFunctionId(entry.id, [])),
			entry.steps.flatMap(step => {
				if (step.type === 'module') {
					return semanticReferences.modules[step.id].skipExecutionInCycle ? [] : [moduleKey(step.id)];
				}
				return [functionKey(createFunctionId(step.id, []))];
			})
		);
	}
	const recursive = findRecursiveNodes(edges);
	return {
		functions: Object.fromEntries(
			Object.values(semanticReferences.functions).map(({ metadata, body }) => {
				let hasExplicitReturn = false;
				let hasEarlyReturn = false;
				for (const [index, { line }] of body.entries()) {
					if (line.instruction !== 'return') continue;
					hasExplicitReturn = true;
					if (index < body.length - 1) hasEarlyReturn = true;
				}
				return [
					metadata.id,
					{
						isImported: metadata.import !== undefined,
						hasExplicitReturn,
						hasEarlyReturn,
						isRecursive: recursive.has(functionKey(metadata.id)),
					},
				];
			})
		),
	};
}
