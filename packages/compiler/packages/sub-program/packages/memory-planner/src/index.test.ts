import { CompilerError } from '@8f4e/compiler-diagnostics';
import type {
	ArgumentCompileTimeExpression,
	CompilerASTLine,
	CompileTimeOperator,
	CompileTimeRoundingValue,
	MemoryDeclarationLine,
	ValidatedModuleAST,
} from '@8f4e/language-spec';
import { ArgumentType, arrayMemoryDeclarationInstructions, ErrorCode } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { planSubProgramMemoryLayout } from './index';

function identifier(value: string) {
	return {
		type: ArgumentType.IDENTIFIER,
		value,
		referenceKind: 'plain',
		scope: 'local',
	} as const;
}

function literal(value: number) {
	return {
		type: ArgumentType.LITERAL,
		value,
		isInteger: Number.isInteger(value),
	} as const;
}

function expression(
	left: ReturnType<typeof literal>,
	operator: CompileTimeOperator,
	right: ReturnType<typeof literal>,
	rounding?: CompileTimeRoundingValue
): ArgumentCompileTimeExpression {
	return {
		type: ArgumentType.COMPILE_TIME_EXPRESSION,
		left,
		operator,
		right,
		...(rounding ? { rounding } : {}),
	};
}

function moduleLine(id: string, lineNumber: number) {
	return {
		diagnosticSource: { kind: 'document' },
		lineNumber,
		instruction: 'module',
		arguments: [identifier(id)],
	} as const;
}

function validatedModuleAst(id: string, lineNumber: number, lines: readonly CompilerASTLine[]): ValidatedModuleAST {
	const line = moduleLine(id, lineNumber);

	return {
		type: 'module',
		id,
		lines: [line, ...lines],
		moduleLine: line,
	} as ValidatedModuleAST;
}

function noConstantReferences() {
	return {
		modules: [],
	};
}

describe('planSubProgramMemoryLayout', () => {
	it('plans module start addresses and declaration addresses from ASTs', () => {
		const plan = planSubProgramMemoryLayout({
			modules: [
				validatedModuleAst('first', 1, [
					{
						diagnosticSource: { kind: 'document' },
						lineNumber: 2,
						instruction: 'int',
						arguments: [identifier('counter')],
					},
					{
						diagnosticSource: { kind: 'document' },
						lineNumber: 3,
						instruction: 'int8[]',
						arguments: [identifier('bytes'), literal(5)],
					},
				]),
				validatedModuleAst('second', 10, [
					{
						diagnosticSource: { kind: 'document' },
						lineNumber: 11,
						instruction: 'float64',
						arguments: [identifier('phase')],
					},
				]),
			],
			constantReferences: noConstantReferences(),
			startingByteAddress: 4,
		});

		expect(plan.modules.first.byteAddress).toBe(4);
		expect(plan.modules.first.allocationUnitCount).toBe(3);
		expect(plan.modules.first.memory.counter.byteAddress).toBe(4);
		expect(plan.modules.first.memory.bytes.byteAddress).toBe(8);
		expect(plan.modules.second.byteAddress).toBe(16);
		expect(plan.modules.second.memory.phase.byteAddress).toBe(16);
	});

	it('allocates modules alphabetically by id instead of source order', () => {
		const plan = planSubProgramMemoryLayout({
			modules: [
				validatedModuleAst('zeta', 1, [
					{
						diagnosticSource: { kind: 'document' },
						lineNumber: 2,
						instruction: 'int',
						arguments: [identifier('value')],
					},
				]),
				validatedModuleAst('alpha', 10, [
					{
						diagnosticSource: { kind: 'document' },
						lineNumber: 11,
						instruction: 'int[]',
						arguments: [identifier('value'), literal(2)],
					},
				]),
			],
			constantReferences: noConstantReferences(),
			startingByteAddress: 4,
		});

		expect(plan.moduleList.map(module => module.id)).toEqual(['alpha', 'zeta']);
		expect(plan.modules.alpha.byteAddress).toBe(4);
		expect(plan.modules.alpha.memory.value.byteAddress).toBe(4);
		expect(plan.modules.zeta.byteAddress).toBe(12);
		expect(plan.modules.zeta.memory.value.byteAddress).toBe(12);
	});

	it('plans compiler-normalized declaration lines', () => {
		const plan = planSubProgramMemoryLayout({
			modules: [
				validatedModuleAst('main', 1, [
					{
						diagnosticSource: { kind: 'document' },
						lineNumber: 2,
						instruction: 'int[]',
						arguments: [identifier('values'), literal(4)],
					},
				]),
			],
			constantReferences: noConstantReferences(),
		});

		expect(plan.modules.main.memory.values.numberOfElements).toBe(4);
		expect(plan.modules.main.allocationUnitCount).toBe(4);
	});

	it('plans anonymous scalar declarations with generated ids', () => {
		const line = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 2,
			instruction: 'float',
			arguments: [],
		} as MemoryDeclarationLine;

		const plan = planSubProgramMemoryLayout({
			modules: [validatedModuleAst('main', 1, [line, { ...line, lineNumber: 3 }])],
			constantReferences: noConstantReferences(),
		});

		expect(plan.modules.main.declarations).toMatchObject([
			{ id: 0, byteAddress: 4 },
			{ id: 1, byteAddress: 8 },
		]);
		expect(plan.modules.main.declarations.every(declaration => declaration.name === undefined)).toBe(true);
		expect(plan.modules.main.memory).toEqual({});
	});

	it('keeps each declaration source on the shared indexed and named record', () => {
		const foo = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 2,
			instruction: 'int',
			arguments: [identifier('foo')],
		} satisfies MemoryDeclarationLine;
		const bar = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 3,
			instruction: 'float[]',
			arguments: [identifier('bar'), literal(2)],
		} satisfies MemoryDeclarationLine;
		const local = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 12,
			instruction: 'int',
			arguments: [identifier('local')],
		} satisfies MemoryDeclarationLine;

		const plan = planSubProgramMemoryLayout({
			modules: [validatedModuleAst('main', 1, [foo, bar, local])],
			constantReferences: noConstantReferences(),
			startingByteAddress: 4,
		});

		expect(plan.modules.main.declarations.map(declaration => declaration.name)).toEqual(['foo', 'bar', 'local']);
		expect(plan.modules.main.declarations.map(declaration => declaration.source)).toEqual([foo, bar, local]);
		expect(plan.modules.main.memory.bar).toBe(plan.modules.main.declarations[1]);
		expect(plan.modules.main.memory.bar.source).toBe(bar);
		expect(plan.modules.main.memory.local.byteAddress).toBe(16);
	});

	it.each(['buffer', '__proto__'])('reports duplicate storage name %s at the second declaration', name => {
		const first = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 2,
			instruction: 'int',
			arguments: [identifier(name)],
		} satisfies MemoryDeclarationLine;
		const duplicate = {
			diagnosticSource: { kind: 'block', projectBlockId: 7, projectGroupPath: 'audio' },
			lineNumber: 4,
			instruction: 'float[]',
			arguments: [identifier(name), literal(1)],
		} satisfies MemoryDeclarationLine;

		expect(() =>
			planSubProgramMemoryLayout({
				modules: [validatedModuleAst('audio/voice', 1, [first, duplicate])],
				constantReferences: noConstantReferences(),
			})
		).toThrow(
			expect.objectContaining({
				diagnostic: expect.objectContaining({
					code: ErrorCode.DUPLICATE_IDENTIFIER,
					instruction: 'float[]',
					message: `Duplicate identifier: ${name}. (45)`,
					location: { ...duplicate.diagnosticSource, lineNumber: duplicate.lineNumber },
				}),
			})
		);
	});
});

describe('planner input building', () => {
	it.each([
		['round', 2],
		['floor', 1],
		['ceil', 2],
	] as const)('plans a pre-resolved explicitly %s array element count', (rounding, expectedElementCount) => {
		const line = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 4,
			instruction: 'float[]',
			arguments: [identifier('values'), expression(literal(3), '/', literal(2), rounding)],
		} satisfies MemoryDeclarationLine;

		const plan = planSubProgramMemoryLayout({
			modules: [validatedModuleAst('main', 1, [line])],
			constantReferences: {
				modules: [{ lineFacts: [undefined, { arguments: [identifier('values'), literal(expectedElementCount)] }] }],
			},
		});

		expect(plan.modules.main.memory.values.numberOfElements).toBe(expectedElementCount);
	});

	it.each(
		arrayMemoryDeclarationInstructions.flatMap(instruction =>
			[0.5, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].map(
				size => [instruction, size] as const
			)
		)
	)('rejects %s with invalid element count %s', (instruction, size) => {
		const line = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 4,
			instruction,
			arguments: [identifier('values'), literal(size)],
		} satisfies MemoryDeclarationLine;

		expect(() =>
			planSubProgramMemoryLayout({
				modules: [validatedModuleAst('main', 1, [line])],
				constantReferences: noConstantReferences(),
			})
		).toThrow(
			expect.objectContaining({
				diagnostic: expect.objectContaining({
					code: ErrorCode.INVALID_ARRAY_SIZE,
					instruction: line.instruction,
					location: expect.objectContaining({ ...line.diagnosticSource, lineNumber: line.lineNumber }),
				}),
			})
		);
	});

	it('builds planner-ready source from validated module ASTs', () => {
		const counter = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 3,
			instruction: 'int',
			arguments: [identifier('counter')],
		} satisfies MemoryDeclarationLine;
		const local = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 4,
			instruction: 'int[]',
			arguments: [identifier('values'), expression(literal(2), '*', literal(3))],
		} satisfies MemoryDeclarationLine;

		const plan = planSubProgramMemoryLayout({
			modules: [validatedModuleAst('main', 1, [counter, local])],
			constantReferences: {
				modules: [
					{
						lineFacts: [undefined, undefined, { arguments: [identifier('values'), literal(6)] }],
					},
				],
			},
			startingByteAddress: 4,
		});

		expect(plan.modules.main.declarations.map(declaration => declaration.name)).toEqual(['counter', 'values']);
		expect(plan.modules.main.memory.values.numberOfElements).toBe(6);
		expect(plan.modules.main.declarations.map(declaration => declaration.source)).toEqual([
			counter,
			{
				...local,
				arguments: [identifier('values'), literal(6)],
			},
		]);
	});

	it('rejects compile-time expressions that were not resolved by the constant pass', () => {
		const line = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 4,
			instruction: 'int[]',
			arguments: [identifier('values'), expression(literal(2), '*', literal(3))],
		} satisfies MemoryDeclarationLine;

		expect(() =>
			planSubProgramMemoryLayout({
				modules: [validatedModuleAst('main', 1, [line])],
				constantReferences: noConstantReferences(),
			})
		).toThrow(CompilerError);
	});

	it('rejects unresolved array declaration sizes while building planner input', () => {
		const line = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 4,
			instruction: 'int[]',
			arguments: [identifier('values'), identifier('missing')],
		} satisfies MemoryDeclarationLine;

		expect(() =>
			planSubProgramMemoryLayout({
				modules: [validatedModuleAst('main', 1, [line])],
				constantReferences: noConstantReferences(),
			})
		).toThrow(CompilerError);
	});

	it('uses constant resolution facts while keeping source declaration lines unchanged', () => {
		const sizeIdentifier = identifier('SIZE');
		const line = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 4,
			instruction: 'int[]',
			arguments: [identifier('values'), sizeIdentifier],
		} satisfies MemoryDeclarationLine;

		const plan = planSubProgramMemoryLayout({
			modules: [validatedModuleAst('main', 1, [line])],
			constantReferences: {
				modules: [
					{
						lineFacts: [
							undefined,
							{
								arguments: [identifier('values'), literal(7)],
							},
							undefined,
						],
					},
				],
			},
		});

		expect(line.arguments[1]).toBe(sizeIdentifier);
		expect(plan.modules.main.memory.values.numberOfElements).toBe(7);
	});

	it('preserves declaration order across non-declaration lines without mutating the input AST', () => {
		const counter = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 13,
			instruction: 'int',
			arguments: [identifier('counter')],
		} satisfies MemoryDeclarationLine;
		const firstDeclaration = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 11,
			instruction: 'int',
			arguments: [identifier('first')],
		} satisfies MemoryDeclarationLine;
		const ignoredInstruction = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 12,
			instruction: 'push',
			arguments: [literal(1)],
		} as unknown as CompilerASTLine;
		const sizeIdentifier = identifier('COUNT');
		const arrayDeclaration = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 14,
			instruction: 'int[]',
			arguments: [identifier('items'), sizeIdentifier],
		} satisfies MemoryDeclarationLine;
		const moduleAst = validatedModuleAst('main', 10, [firstDeclaration, ignoredInstruction, counter, arrayDeclaration]);
		const originalLinesSnapshot = [...moduleAst.lines];
		const originalArrayArgumentsSnapshot = [...arrayDeclaration.arguments];

		const plan = planSubProgramMemoryLayout({
			modules: [moduleAst],
			constantReferences: {
				modules: [
					{
						lineFacts: [undefined, undefined, undefined, undefined, { arguments: [identifier('items'), literal(3)] }],
					},
				],
			},
			startingByteAddress: 4,
		});

		expect(plan.modules.main.declarations.map(declaration => declaration.name)).toEqual(['first', 'counter', 'items']);
		expect(plan.modules.main.declarations.map(declaration => declaration.source)).toEqual([
			firstDeclaration,
			counter,
			{
				...arrayDeclaration,
				arguments: [identifier('items'), literal(3)],
			},
		]);
		expect(moduleAst.lines).toEqual(originalLinesSnapshot);
		expect(arrayDeclaration.arguments).toEqual(originalArrayArgumentsSnapshot);
	});
});
