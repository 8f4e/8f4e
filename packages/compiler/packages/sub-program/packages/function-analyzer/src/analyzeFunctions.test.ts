import { ArgumentType, createFunctionId, type ExecutableInstructionLine, type FunctionAST } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { analyzeFunctions } from './analyzeFunctions';

describe('analyzeFunctions', () => {
	it('counts operations and reports distinct instruction and push operand kinds', () => {
		const id = createFunctionId('leaf', []);
		const push: ExecutableInstructionLine = {
			instruction: 'push',
			lineNumber: 0,
			arguments: [{ type: ArgumentType.LITERAL, value: 7, isInteger: true }],
		};
		const drop: ExecutableInstructionLine = { instruction: 'drop', lineNumber: 0, arguments: [] };
		const body = Array.from({ length: 7 }, () => [push, drop])
			.flat()
			.map((line, index) => ({
				line: { ...line, lineNumber: index + 1 },
				sourceLineIndex: index + 1,
			}));
		const functionLine: FunctionAST['functionLine'] = {
			instruction: 'function',
			lineNumber: 0,
			arguments: [{ type: ArgumentType.IDENTIFIER, value: 'leaf', referenceKind: 'plain', scope: 'local' }],
		};
		const functionEndLine: FunctionAST['functionEndLine'] = {
			instruction: 'functionEnd',
			lineNumber: body.length + 1,
			arguments: [],
		};
		const facts = { stackBefore: [], stackAfter: [], consumedOperands: [], producedStackItems: [] };
		const report = analyzeFunctions({
			semanticReferences: {
				modules: {},
				functions: {
					[id]: {
						ast: {
							type: 'function',
							name: 'leaf',
							functionLine,
							functionEndLine,
							lines: [functionLine, ...body.map(({ line }) => line), functionEndLine],
						},
						metadata: { id, name: 'leaf', signature: { parameters: [], returns: [] } },
						bindings: [],
						body,
					},
				},
			},
			stackReport: {
				modules: {},
				functions: {
					[id]: {
						functionId: id,
						finalStack: [],
						stackAnalysis: [],
						operationFacts: body.map(() => ({ stackAnalysis: facts })),
					},
				},
			},
			entries: [],
		});
		expect(report.functions[id].bodyFacts).toMatchObject({
			operationCount: 14,
			instructionKinds: ['push', 'drop'],
			pushOperandKinds: ['literal'],
		});
	});
});
