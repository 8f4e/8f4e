import type {
	CodegenInstructionName,
	CodegenPushLine,
	ComposedEntry,
	FunctionAnalysis,
	ResolvedPushLine,
	StackAnalysisLineFacts,
} from '@8f4e/language-spec';
import { ArgumentType, createFunctionId, isPointerFunctionValueType } from '@8f4e/language-spec';
import type { FunctionSemanticReferences, SemanticReferenceReport } from '@8f4e/semantic-reference-resolver';
import type { StackAnalysisSubProgramReport } from '@8f4e/stack-analyzer';
import { findRecursiveNodes } from './callGraph';

export interface AnalyzeFunctionsInput {
	semanticReferences: SemanticReferenceReport;
	stackReport: StackAnalysisSubProgramReport;
	entries: readonly ComposedEntry[];
}

type PushOperandKind = ResolvedPushLine['resolvedTarget']['kind'] | 'literal' | 'address-literal' | 'string-literal';

/** Structural facts about a resolved body and its declared values. */
export interface FunctionBodyFacts {
	operationCount: number;
	instructionKinds: readonly CodegenInstructionName[];
	pushOperandKinds: readonly PushOperandKind[];
	hasPointerBindings: boolean;
	hasPointerReturns: boolean;
}

interface AnalyzedFunction {
	analysis: FunctionAnalysis;
	bodyFacts: FunctionBodyFacts;
}

/** Structural facts keyed by the canonical identity of each source function overload. */
export interface FunctionAnalysisReport {
	functions: Record<string, AnalyzedFunction>;
}

function getPushOperandKind(line: CodegenPushLine): PushOperandKind {
	if ('resolvedTarget' in line) return line.resolvedTarget.kind;
	const [operand] = line.arguments;
	if (operand.type === ArgumentType.STRING_LITERAL) return 'string-literal';
	return operand.address ? 'address-literal' : 'literal';
}

function analyzeFunction(
	{ metadata, bindings, body }: FunctionSemanticReferences,
	isRecursive: boolean
): AnalyzedFunction {
	const instructionKinds = new Set<CodegenInstructionName>();
	const pushOperandKinds = new Set<PushOperandKind>();
	let hasEarlyReturn = false;
	for (const [index, { line }] of body.entries()) {
		instructionKinds.add(line.instruction);
		if (line.instruction === 'push') pushOperandKinds.add(getPushOperandKind(line));
		if (line.instruction === 'return' && index < body.length - 1) hasEarlyReturn = true;
	}
	return {
		analysis: {
			isImported: metadata.import !== undefined,
			hasExplicitReturn: instructionKinds.has('return'),
			hasEarlyReturn,
			isRecursive,
		},
		bodyFacts: {
			operationCount: body.length,
			instructionKinds: [...instructionKinds],
			pushOperandKinds: [...pushOperandKinds],
			hasPointerBindings: bindings.some(binding => isPointerFunctionValueType(binding.type)),
			hasPointerReturns: metadata.signature.returns.some(isPointerFunctionValueType),
		},
	};
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
			Object.entries(semanticReferences.functions).map(([id, resolved]) => [
				id,
				analyzeFunction(resolved, recursive.has(functionKey(id))),
			])
		),
	};
}
