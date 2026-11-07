import type { ExecutableInstructionLine, FunctionAnalysis, SourceLocalBinding } from '@8f4e/language-spec';
import { ArgumentType, createFunctionId } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { type PlanFunctionInliningInput, planFunctionInlining } from './planFunctionInlining';

const id = (name: string) => createFunctionId(name, []);
const identifier = (value: string) => ({
	type: ArgumentType.IDENTIFIER,
	value,
	referenceKind: 'plain' as const,
	scope: 'local' as const,
});
const call = (name: string): ExecutableInstructionLine => ({
	instruction: 'call',
	arguments: [identifier(name)],
	lineNumber: 1,
});
const emptyStack: ExecutableInstructionLine = { instruction: 'clearStack', arguments: [], lineNumber: 1 };

function program(
	specs: {
		name: string;
		body: ExecutableInstructionLine[];
		analysis?: Partial<FunctionAnalysis>;
		bindings?: SourceLocalBinding[];
	}[]
): PlanFunctionInliningInput {
	const input: PlanFunctionInliningInput = {
		semanticReferences: { functions: {}, modules: {} },
		stackReport: { functions: {}, modules: {} },
		functionAnalysis: { functions: {} },
	};
	for (const spec of specs) {
		const functionId = id(spec.name);
		input.semanticReferences.functions[functionId] = {
			metadata: { id: functionId, name: spec.name, signature: { parameters: [], returns: [] } },
			ast: {
				type: 'function',
				name: spec.name,
				lines: spec.body,
				functionLine: { instruction: 'function', arguments: [identifier(spec.name)], lineNumber: 0 },
				functionEndLine: { instruction: 'functionEnd', arguments: [], lineNumber: spec.body.length + 1 },
			},
			bindings: spec.bindings ?? [],
			body: spec.body.map(line => ({ line, sourceLineIndex: line.lineNumber })),
		};
		input.stackReport.functions[functionId] = {
			functionId,
			finalStack: [],
			stackAnalysis: [],
			operationFacts: spec.body.map(line => ({
				stackAnalysis: { stackBefore: [], stackAfter: [], consumedOperands: [], producedStackItems: [] },
				...(line.instruction === 'call' ? { targetFunctionId: id(line.arguments[0].value) } : {}),
			})),
		};
		input.functionAnalysis.functions[functionId] = {
			isImported: false,
			isRecursive: false,
			hasExplicitReturn: false,
			hasEarlyReturn: false,
			...spec.analysis,
		};
	}
	return input;
}

describe('function inlining plans', () => {
	it('uses function-analysis facts to exclude imports, recursion, and early returns', () => {
		const input = program([
			{ name: 'imported', body: [], analysis: { isImported: true } },
			{ name: 'recursive', body: [call('recursive')], analysis: { isRecursive: true } },
			{
				name: 'early',
				body: [{ instruction: 'return', arguments: [], lineNumber: 1 }, emptyStack],
				analysis: { hasExplicitReturn: true, hasEarlyReturn: true },
			},
			{ name: 'ordinary', body: [emptyStack] },
			{ name: 'caller', body: [call('imported'), call('recursive'), call('early'), call('ordinary')] },
		]);
		expect([...planFunctionInlining(input).functions[id('caller')].keys()]).toEqual([3]);
	});

	it('drops a terminal return from the copy without mutating the original body or facts', () => {
		const input = program([
			{
				name: 'callee',
				body: [emptyStack, { instruction: 'return', arguments: [], lineNumber: 2 }],
				analysis: { hasExplicitReturn: true },
			},
			{ name: 'caller', body: [call('callee')] },
		]);
		const before = structuredClone(input);
		const body = planFunctionInlining(input).functions[id('caller')].get(0)!;
		expect(body.operations.map(operation => operation.line.instruction)).toEqual(['clearStack']);
		expect(body.operations[0].facts).toBe(input.stackReport.functions[id('callee')].operationFacts[0]);
		expect(input).toEqual(before);
	});

	it('accounts for source-local resets and scope blocks in the caller growth budget', () => {
		const input = program([
			{ name: 'callee', body: [emptyStack], bindings: [{ id: 0, name: 'value', type: 'int' }] },
			{ name: 'caller', body: [call('callee'), call('callee')] },
		]);
		expect(planFunctionInlining(input, { maxCallerOperations: 5 }).functions[id('caller')].size).toBe(0);
		expect([...planFunctionInlining(input, { maxCallerOperations: 6 }).functions[id('caller')].keys()]).toEqual([0]);
		expect(planFunctionInlining(input, { maxCalleeOperations: 0 }).functions[id('caller')].size).toBe(0);
	});

	it('copies original bodies only, leaving calls inside an expansion unexpanded', () => {
		const input = program([
			{ name: 'leaf', body: [emptyStack] },
			{ name: 'middle', body: [call('leaf')] },
			{ name: 'outer', body: [call('middle')] },
		]);
		const plan = planFunctionInlining(input);
		expect(plan.functions[id('middle')].get(0)!.id).toBe(id('leaf'));
		expect(plan.functions[id('outer')].get(0)!.operations[0].line.instruction).toBe('call');
		expect(plan.functions[id('outer')].get(0)!.operations[0].facts.targetFunctionId).toBe(id('leaf'));
	});
});
