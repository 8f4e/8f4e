import type {
	ArrayMemoryDeclarationLine,
	CompilerASTLine,
	MemoryDeclarationLine,
	ModuleLine,
	ShapeLine,
	ValidatedModuleAST,
	ValidatedPrototypeAST,
} from '@8f4e/language-spec';
import { ArgumentType, ErrorCode } from '@8f4e/language-spec';
import { planSubProgramMemoryLayout } from '@8f4e/memory-planner';
import { describe, expect, it } from 'vitest';
import { MemoryDefaultResolverError, type ResolveMemoryDefaultsInput, resolveMemoryDefaults } from './index';

const { classifyIdentifier } = await import('@8f4e/tokenizer');

function literal(value: number, isInteger = Number.isInteger(value)) {
	return {
		type: ArgumentType.LITERAL,
		value,
		isInteger,
	} as const;
}

function moduleLine(id: string, lineNumber = 1): ModuleLine {
	return {
		lineNumber,
		instruction: 'module',
		arguments: [classifyIdentifier(id)],
	};
}

function scalarLine(
	lineNumber: number,
	instruction: MemoryDeclarationLine['instruction'],
	args: MemoryDeclarationLine['arguments']
): MemoryDeclarationLine {
	return {
		lineNumber,
		instruction,
		arguments: args,
	} as MemoryDeclarationLine;
}

function arrayLine(
	lineNumber: number,
	instruction: ArrayMemoryDeclarationLine['instruction'],
	args: ArrayMemoryDeclarationLine['arguments']
): ArrayMemoryDeclarationLine {
	return {
		lineNumber,
		instruction,
		arguments: args,
	};
}

function moduleAst(id: string, lines: readonly CompilerASTLine[]): ValidatedModuleAST {
	const line = moduleLine(id);

	return {
		type: 'module',
		id,
		moduleLine: line,
		lines: [line, ...lines],
	} as ValidatedModuleAST;
}

function prototypeAst(id: string, declarationLines: readonly MemoryDeclarationLine[]): ValidatedPrototypeAST {
	const prototypeLine = {
		lineNumber: 1,
		instruction: 'prototype',
		arguments: [classifyIdentifier(id)],
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

function noMemoryReferences(
	memoryPlan: ReturnType<typeof planSubProgramMemoryLayout>
): ResolveMemoryDefaultsInput['memoryReferences'] {
	return {
		declarationSourcesByModuleId: Object.fromEntries(
			memoryPlan.moduleList.map(module => [module.id, { lineFacts: [] }])
		),
	};
}

describe('resolveMemoryDefaults', () => {
	it('resolves scalar and array declaration defaults', () => {
		const counter = scalarLine(2, 'int', [classifyIdentifier('counter'), literal(7)]);
		const values = arrayLine(3, 'float[]', [
			classifyIdentifier('values'),
			literal(3),
			literal(1.5, false),
			literal(2.5, false),
		]);
		const module = moduleAst('main', [counter, values]);
		const memoryPlan = planSubProgramMemoryLayout({
			prototypes: [],
			modules: [module],
			constantReferences: noConstantReferences(),
		});

		const result = resolveMemoryDefaults({
			memoryPlan,
			memoryReferences: noMemoryReferences(memoryPlan),
		});

		expect(result.main).toEqual({
			0: { value: 7, hasExplicitDefault: true, isInherited: false },
			1: { value: { 0: 1.5, 1: 2.5 }, hasExplicitDefault: true, isInherited: false },
		});
	});

	it('derives explicit default markers from declaration syntax', () => {
		const implicitScalar = scalarLine(2, 'int', [classifyIdentifier('implicitScalar')]);
		const explicitScalar = scalarLine(3, 'int', [classifyIdentifier('explicitScalar'), literal(0)]);
		const anonymousScalar = scalarLine(4, 'int', [literal(9)]);
		const implicitArray = arrayLine(5, 'int[]', [classifyIdentifier('implicitArray'), literal(2)]);
		const explicitArray = arrayLine(6, 'int[]', [classifyIdentifier('explicitArray'), literal(2), literal(1)]);
		const module = moduleAst('main', [implicitScalar, explicitScalar, anonymousScalar, implicitArray, explicitArray]);
		const memoryPlan = planSubProgramMemoryLayout({
			prototypes: [],
			modules: [module],
			constantReferences: noConstantReferences(),
		});

		const result = resolveMemoryDefaults({
			memoryPlan,
			memoryReferences: noMemoryReferences(memoryPlan),
		});

		expect(result.main).toMatchObject({
			0: { hasExplicitDefault: false },
			1: { hasExplicitDefault: true },
			2: { hasExplicitDefault: true },
			3: { hasExplicitDefault: false },
			4: { hasExplicitDefault: true },
		});
	});

	it('resolves pointer address defaults from declaration reference facts', () => {
		const buffer = arrayLine(2, 'int[]', [classifyIdentifier('buffer'), literal(4)]);
		const pointer = scalarLine(3, 'int*', [classifyIdentifier('ptr'), classifyIdentifier('&buffer')]);
		const module = moduleAst('main', [buffer, pointer]);
		const memoryPlan = planSubProgramMemoryLayout({
			prototypes: [],
			modules: [module],
			constantReferences: noConstantReferences(),
			startingByteAddress: 4,
		});
		const bufferDeclaration = memoryPlan.modules.main.memory.buffer;
		const memoryReferences = noMemoryReferences(memoryPlan);
		memoryReferences.declarationSourcesByModuleId.main = {
			lineFacts: [
				undefined,
				{
					arguments: [
						classifyIdentifier('ptr'),
						{
							type: ArgumentType.LITERAL,
							value: bufferDeclaration.byteAddress,
							isInteger: true,
							address: {
								safeRange: {
									source: 'memory-start',
									byteAddress: bufferDeclaration.byteAddress,
									safeByteLength: bufferDeclaration.elementByteLength,
									moduleId: 'main',
									memoryId: 0,
								},
							},
						},
					],
				},
			],
		};

		const result = resolveMemoryDefaults({
			memoryPlan,
			memoryReferences,
		});

		expect(result.main[1]).toMatchObject({
			value: memoryPlan.modules.main.memory.buffer.byteAddress,
			hasExplicitDefault: true,
			isInherited: false,
		});
	});

	it('preserves inherited shape defaults until local declarations override them', () => {
		const prototypeFoo = scalarLine(2, 'int', [classifyIdentifier('foo'), literal(1)]);
		const prototypeBar = scalarLine(3, 'int', [classifyIdentifier('bar'), literal(3)]);
		const shape = {
			lineNumber: 11,
			instruction: 'shape',
			arguments: [classifyIdentifier('state')],
		} satisfies ShapeLine;
		const localFoo = scalarLine(12, 'int', [classifyIdentifier('foo'), literal(2)]);
		const prototype = prototypeAst('state', [prototypeFoo, prototypeBar]);
		const module = moduleAst('main', [shape, localFoo]);
		const memoryPlan = planSubProgramMemoryLayout({
			prototypes: [prototype],
			modules: [module],
			constantReferences: noConstantReferences(),
		});

		const result = resolveMemoryDefaults({
			memoryPlan,
			memoryReferences: noMemoryReferences(memoryPlan),
		});

		expect(result.main).toEqual({
			0: { value: 2, hasExplicitDefault: true, isInherited: true },
			2: { value: 2, hasExplicitDefault: true, isInherited: false },
			1: { value: 3, hasExplicitDefault: true, isInherited: true },
		});
	});

	it('rejects array initializers longer than the planned array', () => {
		const values = arrayLine(2, 'int[]', [
			classifyIdentifier('values'),
			literal(2),
			literal(1),
			literal(2),
			literal(3),
		]);
		const module = moduleAst('main', [values]);
		const memoryPlan = planSubProgramMemoryLayout({
			prototypes: [],
			modules: [module],
			constantReferences: noConstantReferences(),
		});

		expect(() =>
			resolveMemoryDefaults({
				memoryPlan,
				memoryReferences: noMemoryReferences(memoryPlan),
			})
		).toThrow(MemoryDefaultResolverError);
		expect(() =>
			resolveMemoryDefaults({
				memoryPlan,
				memoryReferences: noMemoryReferences(memoryPlan),
			})
		).toThrow(expect.objectContaining({ compilerErrorCode: ErrorCode.ARRAY_INITIALIZER_TOO_LONG }));
	});
});
