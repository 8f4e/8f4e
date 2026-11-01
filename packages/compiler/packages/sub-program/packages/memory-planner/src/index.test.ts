import type {
	ArgumentCompileTimeExpression,
	CompilerASTLine,
	CompileTimeOperator,
	CompileTimeRoundingValue,
	MemoryDeclarationLine,
	ShapeLine,
	ValidatedModuleAST,
	ValidatedPrototypeAST,
} from '@8f4e/language-spec';
import { ArgumentType, arrayMemoryDeclarationInstructions, ErrorCode } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { MemoryPlannerError, planSubProgramMemoryLayout } from './index';

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

function shapeLine(id: string, lineNumber: number): ShapeLine {
	return {
		lineNumber,
		instruction: 'shape',
		arguments: [identifier(id)],
	};
}

function moduleLine(id: string, lineNumber: number) {
	return {
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

function prototypeAst(
	id: string,
	lineNumber: number,
	declarationLines: readonly MemoryDeclarationLine[]
): ValidatedPrototypeAST {
	const prototypeLine = {
		lineNumber,
		instruction: 'prototype',
		arguments: [identifier(id)],
	} as const;

	return {
		type: 'prototype',
		id,
		lines: [prototypeLine, ...declarationLines],
		prototypeLine,
	} as ValidatedPrototypeAST;
}

function noConstantReferences() {
	return {
		prototypes: [],
		modules: [],
	};
}

describe('planSubProgramMemoryLayout', () => {
	it('plans module start addresses and declaration addresses from ASTs', () => {
		const plan = planSubProgramMemoryLayout({
			prototypes: [],
			modules: [
				validatedModuleAst('first', 1, [
					{
						lineNumber: 2,
						instruction: 'int',
						arguments: [identifier('counter')],
					},
					{
						lineNumber: 3,
						instruction: 'int8[]',
						arguments: [identifier('bytes'), literal(5)],
					},
				]),
				validatedModuleAst('second', 10, [
					{
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
			prototypes: [],
			modules: [
				validatedModuleAst('zeta', 1, [
					{
						lineNumber: 2,
						instruction: 'int',
						arguments: [identifier('last')],
					},
				]),
				validatedModuleAst('alpha', 10, [
					{
						lineNumber: 11,
						instruction: 'int[]',
						arguments: [identifier('first'), literal(2)],
					},
				]),
			],
			constantReferences: noConstantReferences(),
			startingByteAddress: 4,
		});

		expect(plan.moduleList.map(module => module.id)).toEqual(['alpha', 'zeta']);
		expect(plan.modules.alpha.byteAddress).toBe(4);
		expect(plan.modules.alpha.memory.first.byteAddress).toBe(4);
		expect(plan.modules.zeta.byteAddress).toBe(12);
		expect(plan.modules.zeta.memory.last.byteAddress).toBe(12);
	});

	it('plans compiler-normalized declaration lines', () => {
		const plan = planSubProgramMemoryLayout({
			prototypes: [],
			modules: [
				validatedModuleAst('main', 1, [
					{
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
			lineNumber: 2,
			instruction: 'float',
			arguments: [],
		} as MemoryDeclarationLine;

		const plan = planSubProgramMemoryLayout({
			prototypes: [],
			modules: [validatedModuleAst('main', 1, [line])],
			constantReferences: noConstantReferences(),
		});

		expect(plan.modules.main.declarations[0].id).toBe('__anonymous__2');
		expect(plan.modules.main.memory.__anonymous__2.byteAddress).toBe(4);
	});

	it('expands shape declarations into effective declaration sources', () => {
		const foo = {
			lineNumber: 2,
			instruction: 'int',
			arguments: [identifier('foo')],
		} satisfies MemoryDeclarationLine;
		const bar = {
			lineNumber: 3,
			instruction: 'float[]',
			arguments: [identifier('bar'), literal(2)],
		} satisfies MemoryDeclarationLine;
		const local = {
			lineNumber: 12,
			instruction: 'int',
			arguments: [identifier('local')],
		} satisfies MemoryDeclarationLine;

		const plan = planSubProgramMemoryLayout({
			prototypes: [prototypeAst('state', 1, [foo, bar])],
			modules: [validatedModuleAst('main', 1, [shapeLine('state', 11), local])],
			constantReferences: noConstantReferences(),
			startingByteAddress: 4,
		});

		expect(plan.modules.main.declarations.map(declaration => declaration.id)).toEqual(['foo', 'bar', 'local']);
		expect(plan.modules.main.declarationSources).toEqual([
			{ line: { ...foo, lineNumber: 11 }, isInherited: true },
			{ line: { ...bar, lineNumber: 11 }, isInherited: true },
			{ line: local, isInherited: false },
		]);
		expect(plan.modules.main.memory.local.byteAddress).toBe(16);
	});

	it('rejects unknown shape declarations while planning layout', () => {
		expect(() =>
			planSubProgramMemoryLayout({
				prototypes: [],
				modules: [validatedModuleAst('main', 1, [shapeLine('missing', 11)])],
				constantReferences: noConstantReferences(),
			})
		).toThrow(MemoryPlannerError);
	});
});

describe('planner input building', () => {
	it.each([
		['round', 2],
		['floor', 1],
		['ceil', 2],
	] as const)('plans a pre-resolved explicitly %s array element count', (rounding, expectedElementCount) => {
		const line = {
			lineNumber: 4,
			instruction: 'float[]',
			arguments: [identifier('values'), expression(literal(3), '/', literal(2), rounding)],
		} satisfies MemoryDeclarationLine;

		const plan = planSubProgramMemoryLayout({
			prototypes: [],
			modules: [validatedModuleAst('main', 1, [line])],
			constantReferences: {
				prototypes: [],
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
			lineNumber: 4,
			instruction,
			arguments: [identifier('values'), literal(size)],
		} satisfies MemoryDeclarationLine;

		expect(() =>
			planSubProgramMemoryLayout({
				prototypes: [],
				modules: [validatedModuleAst('main', 1, [line])],
				constantReferences: noConstantReferences(),
			})
		).toThrow(expect.objectContaining({ compilerErrorCode: ErrorCode.INVALID_ARRAY_SIZE, line }));
	});

	it('builds planner-ready source from validated module and prototype ASTs', () => {
		const inherited = {
			lineNumber: 20,
			instruction: 'int',
			arguments: [identifier('inherited')],
		} satisfies MemoryDeclarationLine;
		const local = {
			lineNumber: 4,
			instruction: 'int[]',
			arguments: [identifier('values'), expression(literal(2), '*', literal(3))],
		} satisfies MemoryDeclarationLine;

		const plan = planSubProgramMemoryLayout({
			prototypes: [prototypeAst('state', 19, [inherited])],
			modules: [validatedModuleAst('main', 1, [shapeLine('state', 3), local])],
			constantReferences: {
				prototypes: [{ lineFacts: [] }],
				modules: [
					{
						lineFacts: [undefined, undefined, { arguments: [identifier('values'), literal(6)] }],
					},
				],
			},
			startingByteAddress: 4,
		});

		expect(plan.modules.main.declarations.map(declaration => declaration.id)).toEqual(['inherited', 'values']);
		expect(plan.modules.main.memory.values.numberOfElements).toBe(6);
		expect(plan.modules.main.declarationSources).toEqual([
			{ line: { ...inherited, lineNumber: 3 }, isInherited: true },
			{
				line: {
					...local,
					arguments: [identifier('values'), literal(6)],
				},
				isInherited: false,
			},
		]);
	});

	it('rejects compile-time expressions that were not resolved by the constant pass', () => {
		const line = {
			lineNumber: 4,
			instruction: 'int[]',
			arguments: [identifier('values'), expression(literal(2), '*', literal(3))],
		} satisfies MemoryDeclarationLine;

		expect(() =>
			planSubProgramMemoryLayout({
				prototypes: [],
				modules: [validatedModuleAst('main', 1, [line])],
				constantReferences: noConstantReferences(),
			})
		).toThrow(MemoryPlannerError);
	});

	it('rejects unresolved array declaration sizes while building planner input', () => {
		const line = {
			lineNumber: 4,
			instruction: 'int[]',
			arguments: [identifier('values'), identifier('missing')],
		} satisfies MemoryDeclarationLine;

		expect(() =>
			planSubProgramMemoryLayout({
				prototypes: [],
				modules: [validatedModuleAst('main', 1, [line])],
				constantReferences: noConstantReferences(),
			})
		).toThrow(MemoryPlannerError);
	});

	it('rejects duplicate prototype ids while building planner input', () => {
		const first = prototypeAst('state', 1, []);
		const second = prototypeAst('state', 10, []);

		expect(() =>
			planSubProgramMemoryLayout({
				prototypes: [first, second],
				modules: [],
				constantReferences: noConstantReferences(),
			})
		).toThrow(MemoryPlannerError);
	});

	it('uses constant resolution facts while keeping source declaration lines unchanged', () => {
		const sizeIdentifier = identifier('SIZE');
		const line = {
			lineNumber: 4,
			instruction: 'int[]',
			arguments: [identifier('values'), sizeIdentifier],
		} satisfies MemoryDeclarationLine;

		const plan = planSubProgramMemoryLayout({
			prototypes: [],
			modules: [validatedModuleAst('main', 1, [line])],
			constantReferences: {
				prototypes: [],
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

	it('preserves declaration and shape order across non-declaration lines without mutating the input AST', () => {
		const inherited = {
			lineNumber: 2,
			instruction: 'int',
			arguments: [identifier('inherited')],
		} satisfies MemoryDeclarationLine;
		const firstDeclaration = {
			lineNumber: 11,
			instruction: 'int',
			arguments: [identifier('first')],
		} satisfies MemoryDeclarationLine;
		const ignoredInstruction = {
			lineNumber: 12,
			instruction: 'push',
			arguments: [literal(1)],
		} as unknown as CompilerASTLine;
		const shape = shapeLine('state', 13);
		const sizeIdentifier = identifier('COUNT');
		const arrayDeclaration = {
			lineNumber: 14,
			instruction: 'int[]',
			arguments: [identifier('items'), sizeIdentifier],
		} satisfies MemoryDeclarationLine;
		const moduleAst = validatedModuleAst('main', 10, [firstDeclaration, ignoredInstruction, shape, arrayDeclaration]);
		const originalLinesSnapshot = [...moduleAst.lines];
		const originalArrayArgumentsSnapshot = [...arrayDeclaration.arguments];

		const plan = planSubProgramMemoryLayout({
			prototypes: [prototypeAst('state', 1, [inherited])],
			modules: [moduleAst],
			constantReferences: {
				prototypes: [{ lineFacts: [] }],
				modules: [
					{
						lineFacts: [undefined, undefined, undefined, undefined, { arguments: [identifier('items'), literal(3)] }],
					},
				],
			},
			startingByteAddress: 4,
		});

		expect(plan.modules.main.declarations.map(declaration => declaration.id)).toEqual(['first', 'inherited', 'items']);
		expect(plan.modules.main.declarationSources).toEqual([
			{ line: firstDeclaration, isInherited: false },
			{ line: { ...inherited, lineNumber: 13 }, isInherited: true },
			{
				line: {
					...arrayDeclaration,
					arguments: [identifier('items'), literal(3)],
				},
				isInherited: false,
			},
		]);
		expect(moduleAst.lines).toEqual(originalLinesSnapshot);
		expect(arrayDeclaration.arguments).toEqual(originalArrayArgumentsSnapshot);
	});
});
