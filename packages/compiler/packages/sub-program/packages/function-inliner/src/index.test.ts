import type { FunctionAnalysisReport } from '@8f4e/function-analyzer';
import { ArgumentType, createFunctionId, type ExecutableInstructionLine, type FunctionAST } from '@8f4e/language-spec';
import type { FunctionSemanticReferences, SemanticReferenceReport } from '@8f4e/semantic-reference-resolver';
import { describe, expect, it } from 'vitest';
import { inlineFunctions } from '.';

function identifier(value: string) {
	return { type: ArgumentType.IDENTIFIER, value, referenceKind: 'plain', scope: 'local' } as const;
}

function resolvedFunction(name: string, instructions: ExecutableInstructionLine[]): FunctionSemanticReferences {
	const body = instructions.map((instruction, index) => ({
		line: { ...instruction, lineNumber: index + 1 },
		sourceLineIndex: index + 1,
	}));
	const functionLine: FunctionAST['functionLine'] = {
		instruction: 'function',
		arguments: [identifier(name)],
		lineNumber: 0,
	};
	const functionEndLine: FunctionAST['functionEndLine'] = {
		instruction: 'functionEnd',
		arguments: [],
		lineNumber: body.length + 1,
	};
	return {
		ast: {
			type: 'function',
			name,
			functionLine,
			functionEndLine,
			lines: [functionLine, ...body.map(({ line }) => line), functionEndLine],
		},
		metadata: { id: createFunctionId(name, []), name, signature: { parameters: [], returns: [] } },
		body,
		bindings: [],
	};
}

const push: ExecutableInstructionLine = {
	instruction: 'push',
	lineNumber: 0,
	arguments: [{ type: ArgumentType.LITERAL, value: 7, isInteger: true }],
};
const drop: ExecutableInstructionLine = { instruction: 'drop', lineNumber: 0, arguments: [] };
const call: ExecutableInstructionLine = { instruction: 'call', lineNumber: 0, arguments: [identifier('leaf')] };

function createInput(leafBody: ExecutableInstructionLine[], callCount: number) {
	const leaf = resolvedFunction('leaf', leafBody);
	const caller = resolvedFunction(
		'caller',
		Array.from({ length: callCount }, () => call)
	);
	const semanticReferences: SemanticReferenceReport = {
		modules: {},
		functions: { [leaf.metadata.id]: leaf, [caller.metadata.id]: caller },
	};
	const facts = { stackBefore: [], stackAfter: [], consumedOperands: [], producedStackItems: [] };
	const stackReport = {
		modules: {},
		functions: {
			[leaf.metadata.id]: {
				functionId: leaf.metadata.id,
				finalStack: [],
				stackAnalysis: [],
				operationFacts: leaf.body.map(() => ({ stackAnalysis: facts })),
			},
			[caller.metadata.id]: {
				functionId: caller.metadata.id,
				finalStack: [],
				stackAnalysis: [],
				operationFacts: caller.body.map(() => ({ stackAnalysis: facts, targetFunctionId: leaf.metadata.id })),
			},
		},
	};
	const analysis = { isImported: false, isRecursive: false, hasExplicitReturn: false, hasEarlyReturn: false };
	const scalarTypes = { hasPointerBindings: false, hasPointerReturns: false };
	const functionAnalysis: FunctionAnalysisReport = {
		functions: {
			[leaf.metadata.id]: {
				analysis,
				bodyFacts: {
					operationCount: leafBody.length,
					instructionKinds: ['push', 'drop'],
					pushOperandKinds: ['literal'],
					...scalarTypes,
				},
			},
			[caller.metadata.id]: {
				analysis,
				bodyFacts: {
					operationCount: callCount,
					instructionKinds: ['call'],
					pushOperandKinds: [],
					...scalarTypes,
				},
			},
		},
	};
	const localSlots = { limit: 50_000, reserveScratchSlots: () => 0 };
	return { semanticReferences, stackReport, functionAnalysis, localSlots, caller, leaf };
}

describe('inlineFunctions', () => {
	it('bounds caller growth and keeps original bodies and source lines available', () => {
		const input = createInput([push, drop], 65);
		const result = inlineFunctions(input, { maxCallerGrowth: 64 });
		const { body, ast } = result.functions[input.caller.metadata.id];

		expect(body).toHaveLength(129);
		expect(body[128]).toBe(input.caller.body[64]);
		expect(body.slice(0, 2).map(operation => [operation.line.instruction, operation.sourceLineIndex])).toEqual([
			['push', 1],
			['drop', 1],
		]);
		expect(ast).toBe(input.caller.ast);
		expect(input.caller.body).toHaveLength(65);
		expect(result.functions[input.leaf.metadata.id]).toBe(input.leaf);
		expect(inlineFunctions(input).functions[input.caller.metadata.id].body).toHaveLength(130);
	});

	it('applies an expansion limit when configured', () => {
		const input = createInput(Array.from({ length: 7 }, () => [push, drop]).flat(), 1);
		expect(inlineFunctions(input, { maxExpansionOperations: 12 })).toBe(input.semanticReferences);
		const rewritten = inlineFunctions(input);
		expect(rewritten.functions[input.caller.metadata.id].body).toHaveLength(14);
	});
});
