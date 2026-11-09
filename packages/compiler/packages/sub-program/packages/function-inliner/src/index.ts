import type { FunctionAnalysisReport, FunctionBodyFacts } from '@8f4e/function-analyzer';
import type {
	ArgumentIdentifier,
	CodegenInstructionName,
	ExecutableInstructionLine,
	FunctionAST,
	FunctionInliningOptions,
	ModuleAST,
	SourceLocalBinding,
	StackAnalysisLineFacts,
} from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import type {
	FunctionSemanticReferences,
	ResolvedOperation,
	SemanticReferenceReport,
} from '@8f4e/semantic-reference-resolver';
import type { StackAnalysisSubProgramReport } from '@8f4e/stack-analyzer';

const scalarInstructions: ReadonlySet<CodegenInstructionName> = new Set([
	'abs',
	'add',
	'and',
	'castToFloat',
	'castToFloat64',
	'castToInt',
	'div',
	'drop',
	'equal',
	'equalToZero',
	'greaterOrEqual',
	'greaterOrEqualUnsigned',
	'greaterThan',
	'lessOrEqual',
	'lessThan',
	'localSet',
	'max',
	'min',
	'mul',
	'notEqual',
	'notZero',
	'or',
	'push',
	'remainder',
	'round',
	'shiftLeft',
	'shiftRight',
	'shiftRightUnsigned',
	'sqrt',
	'sub',
	'xor',
]);

interface InlineFunctionsInput<TModule extends ModuleAST, TFunction extends FunctionAST> {
	semanticReferences: SemanticReferenceReport<TModule, TFunction>;
	stackReport: StackAnalysisSubProgramReport;
	functionAnalysis: FunctionAnalysisReport;
}

interface Candidate {
	callee: FunctionSemanticReferences;
	growth: number;
}

interface Body {
	body: readonly ResolvedOperation[];
	bindings: readonly SourceLocalBinding[];
}

interface BodyBuilder {
	body: ResolvedOperation[];
	bindings: SourceLocalBinding[];
}

function hasScalarBody(body: FunctionBodyFacts): boolean {
	return (
		!body.hasPointerBindings &&
		!body.hasPointerReturns &&
		body.instructionKinds.every(instruction => scalarInstructions.has(instruction)) &&
		body.pushOperandKinds.every(kind => kind === 'literal' || kind === 'local')
	);
}

function getCandidates(
	functions: SemanticReferenceReport['functions'],
	functionAnalysis: FunctionAnalysisReport,
	maxExpansionOperations: number
): ReadonlyMap<string, Candidate> {
	const candidates = new Map<string, Candidate>();
	for (const [id, callee] of Object.entries(functions)) {
		const { analysis, bodyFacts } = functionAnalysis.functions[id];
		if (analysis.isImported) continue;
		const { parameters } = callee.metadata.signature;
		const localCount = callee.bindings.length - parameters.length;
		const expansionSize = bodyFacts.operationCount + parameters.length + localCount * 2;
		if (expansionSize <= maxExpansionOperations && hasScalarBody(bodyFacts)) {
			candidates.set(id, { callee, growth: Math.max(0, expansionSize - 1) });
		}
	}
	return candidates;
}

function bindingArgument(binding: SourceLocalBinding): ArgumentIdentifier {
	return { type: ArgumentType.IDENTIFIER, value: binding.name, referenceKind: 'plain', scope: 'local' };
}

function remapBindings(
	line: ExecutableInstructionLine,
	bindings: readonly SourceLocalBinding[],
	lineNumber: number
): ExecutableInstructionLine {
	if (line.instruction === 'localSet') {
		return { ...line, lineNumber, binding: bindings[line.binding.id] };
	}
	if (line.instruction === 'push' && 'resolvedTarget' in line && line.resolvedTarget.kind === 'local') {
		return {
			...line,
			lineNumber,
			resolvedTarget: { kind: 'local', binding: bindings[line.resolvedTarget.binding.id] },
		};
	}
	return { ...line, lineNumber };
}

function expandCall(caller: BodyBuilder, call: ResolvedOperation, callee: FunctionSemanticReferences): void {
	const {
		sourceLineIndex,
		line: { lineNumber },
	} = call;
	const bindings = callee.bindings.map((binding, index) => ({ ...binding, id: caller.bindings.length + index }));
	caller.bindings.push(...bindings);
	const emit = (line: ExecutableInstructionLine) => caller.body.push({ sourceLineIndex, line });
	const store = (binding: SourceLocalBinding) =>
		emit({ instruction: 'localSet', lineNumber, arguments: [bindingArgument(binding)], binding });

	// The last argument is on top of the caller's stack.
	const parameterCount = callee.metadata.signature.parameters.length;
	for (let index = parameterCount - 1; index >= 0; index--) store(bindings[index]);
	for (const binding of bindings.slice(parameterCount)) {
		// Wasm zeroes locals on function entry. An inline expansion can execute repeatedly in one frame.
		emit({
			instruction: 'push',
			lineNumber,
			arguments: [
				{
					type: ArgumentType.LITERAL,
					value: 0,
					isInteger: binding.type === 'int',
					...(binding.type === 'float64' ? { isFloat64: true } : {}),
				},
			],
		});
		store(binding);
	}
	for (const { line } of callee.body) emit(remapBindings(line, bindings, lineNumber));
}

function rewriteBody<T extends Body>(
	original: T,
	facts: readonly StackAnalysisLineFacts[],
	candidates: ReadonlyMap<string, Candidate>,
	maxCallerGrowth: number
): T {
	let rewritten: BodyBuilder | undefined;
	let remainingGrowth = maxCallerGrowth;
	for (const [index, operation] of original.body.entries()) {
		const candidate =
			operation.line.instruction === 'call' ? candidates.get(facts[index].targetFunctionId!) : undefined;
		if (candidate && candidate.growth <= remainingGrowth) {
			rewritten ??= { body: original.body.slice(0, index), bindings: [...original.bindings] };
			expandCall(rewritten, operation, candidate.callee);
			remainingGrowth -= candidate.growth;
		} else {
			rewritten?.body.push(operation);
		}
	}
	return rewritten ? { ...original, ...rewritten } : original;
}

function rewriteBodies<T extends Body>(
	bodies: Record<string, T>,
	stackReport: Record<string, { operationFacts: readonly StackAnalysisLineFacts[] }>,
	candidates: ReadonlyMap<string, Candidate>,
	maxCallerGrowth: number
): Record<string, T> {
	let rewritten: Record<string, T> | undefined;
	for (const [id, body] of Object.entries(bodies)) {
		const result = rewriteBody(body, stackReport[id].operationFacts, candidates, maxCallerGrowth);
		if (result !== body) {
			rewritten ??= { ...bodies };
			rewritten[id] = result;
		}
	}
	return rewritten ?? bodies;
}

/** Replaces eligible calls in resolved bodies, preserving the original report when there are no rewrites. */
export function inlineFunctions<TModule extends ModuleAST, TFunction extends FunctionAST>(
	{ semanticReferences, stackReport, functionAnalysis }: InlineFunctionsInput<TModule, TFunction>,
	{
		maxExpansionOperations = Number.POSITIVE_INFINITY,
		maxCallerGrowth = Number.POSITIVE_INFINITY,
	}: FunctionInliningOptions = {}
): SemanticReferenceReport<TModule, TFunction> {
	const candidates = getCandidates(semanticReferences.functions, functionAnalysis, maxExpansionOperations);
	if (candidates.size === 0) return semanticReferences;
	const modules = rewriteBodies(semanticReferences.modules, stackReport.modules, candidates, maxCallerGrowth);
	const functions = rewriteBodies(semanticReferences.functions, stackReport.functions, candidates, maxCallerGrowth);
	return modules === semanticReferences.modules && functions === semanticReferences.functions
		? semanticReferences
		: { modules, functions };
}
