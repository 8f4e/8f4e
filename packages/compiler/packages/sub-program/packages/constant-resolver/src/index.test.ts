import { CompilerError } from '@8f4e/compiler-diagnostics';
import type {
	ArgumentCompileTimeExpression,
	ArgumentIdentifier,
	ArgumentLiteral,
	CompilerASTLine,
	CompileTimeOperator,
	CompileTimeRoundingValue,
	ConstantsLine,
	ConstLine,
	ModuleEndLine,
	ModuleLine,
	ProjectConstantNamespacePassLine,
	ProjectConstantNamespaceScope,
	PushLine,
	UseLine,
	ValidatedConstantsAST,
	ValidatedModuleAST,
} from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import { ConstantResolverErrorCode, resolveConstants } from './index';

function id(value: string, referenceKind: 'plain' | 'constant' = 'plain'): ArgumentIdentifier {
	return {
		type: ArgumentType.IDENTIFIER,
		value,
		referenceKind,
		scope: 'local',
	};
}

function literal(value: number): ArgumentLiteral {
	return {
		type: ArgumentType.LITERAL,
		value,
		isInteger: Number.isInteger(value),
	};
}

function sizeofId(targetMemoryId: string): ArgumentIdentifier {
	return {
		type: ArgumentType.IDENTIFIER,
		value: `sizeof(${targetMemoryId})`,
		referenceKind: 'element-word-size',
		scope: 'local',
		targetMemoryId,
	};
}

function expression(
	left: ArgumentCompileTimeExpression['left'],
	operator: CompileTimeOperator,
	right: NonNullable<ArgumentCompileTimeExpression['right']>,
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

function roundedOperand(
	left: ArgumentCompileTimeExpression['left'],
	rounding: CompileTimeRoundingValue
): ArgumentCompileTimeExpression {
	return {
		type: ArgumentType.COMPILE_TIME_EXPRESSION,
		left,
		rounding,
	};
}

function moduleLine(lineNumber: number, name: string): ModuleLine {
	return { diagnosticSource: { kind: 'document' }, lineNumber, instruction: 'module', arguments: [id(name)] };
}

function moduleEndLine(lineNumber: number): ModuleEndLine {
	return { diagnosticSource: { kind: 'document' }, lineNumber, instruction: 'moduleEnd', arguments: [] };
}

function constantsLine(lineNumber: number, name: string): ConstantsLine {
	return { diagnosticSource: { kind: 'document' }, lineNumber, instruction: 'constants', arguments: [id(name)] };
}

function useLine(lineNumber: number, name: string): UseLine {
	return { diagnosticSource: { kind: 'document' }, lineNumber, instruction: 'use', arguments: [id(name, 'constant')] };
}

function constLine(lineNumber: number, name: string, value: ConstLine['arguments'][1]): ConstLine {
	return {
		diagnosticSource: { kind: 'document' },
		lineNumber,
		instruction: 'const',
		arguments: [id(name, 'constant'), value],
	};
}

function passLine(lineNumber: number, name: string): ProjectConstantNamespacePassLine {
	return { diagnosticSource: { kind: 'document' }, lineNumber, instruction: 'pass', arguments: [id(name, 'constant')] };
}

function pushLine(lineNumber: number, value: PushLine['arguments'][0]): PushLine {
	return { diagnosticSource: { kind: 'document' }, lineNumber, instruction: 'push', arguments: [value] };
}

function constantsAst(id: string, lines: CompilerASTLine[], constantsLineRef: ConstantsLine): ValidatedConstantsAST {
	return {
		type: 'constants',
		id,
		lines,
		constantsLine: constantsLineRef,
	} as unknown as ValidatedConstantsAST;
}

function moduleAst(id: string, lines: CompilerASTLine[], moduleLineRef: ModuleLine): ValidatedModuleAST {
	return {
		type: 'module',
		id,
		lines,
		moduleLine: moduleLineRef,
	} as unknown as ValidatedModuleAST;
}

describe('constant resolver', () => {
	it('passes named constant namespaces through each explicit project boundary', () => {
		const envLine = constantsLine(1, 'env');
		const env = constantsAst(
			'env',
			[
				envLine,
				constLine(2, 'SAMPLE_RATE', literal(48_000)),
				{ diagnosticSource: { kind: 'document' }, lineNumber: 3, instruction: 'constantsEnd', arguments: [] },
			],
			envLine
		);
		const childModuleLine = moduleLine(1, 'child/module');
		const childUseLine = useLine(2, 'child/env');
		const childPushLine = pushLine(3, id('SAMPLE_RATE', 'constant'));
		const childModule = moduleAst(
			'child/module',
			[childModuleLine, childUseLine, childPushLine, moduleEndLine(4)],
			childModuleLine
		);
		const grandchildModuleLine = moduleLine(1, 'child/grandchild/module');
		const grandchildUseLine = useLine(2, 'child/grandchild/env');
		const grandchildPushLine = pushLine(3, id('SAMPLE_RATE', 'constant'));
		const grandchildModule = moduleAst(
			'child/grandchild/module',
			[grandchildModuleLine, grandchildUseLine, grandchildPushLine, moduleEndLine(4)],
			grandchildModuleLine
		);
		const projectConstantNamespaceScopes: ProjectConstantNamespaceScope[] = [
			{ groupPath: '', passes: [] },
			{
				groupPath: 'child',
				parentGroupPath: '',
				passes: [passLine(2, 'env')],
			},
			{ groupPath: 'child/grandchild', parentGroupPath: 'child', passes: [passLine(2, 'env')] },
		];

		const result = resolveConstants({
			ast: {
				prototypes: [],
				modules: [childModule, grandchildModule],
				constants: [env],
				functions: [],
			},
			projectConstantNamespaceScopes,
		});

		expect(result.references.modules[0].lineFacts[2]).toEqual({ arguments: [literal(48_000)] });
		expect(result.references.modules[1].lineFacts[2]).toEqual({ arguments: [literal(48_000)] });
		expect(result.namespaces['child/env']).toBe(result.namespaces.env);
		expect(result.namespaces['child/grandchild/env']).toBe(result.namespaces.env);
	});

	it('does not import a passed namespace into child blocks automatically', () => {
		const envLine = constantsLine(1, 'env');
		const env = constantsAst(
			'env',
			[
				envLine,
				constLine(2, 'RATE', literal(48_000)),
				{ diagnosticSource: { kind: 'document' }, lineNumber: 3, instruction: 'constantsEnd', arguments: [] },
			],
			envLine
		);
		const childModuleLine = moduleLine(1, 'child/module');
		const childModule = moduleAst(
			'child/module',
			[childModuleLine, pushLine(2, id('RATE', 'constant')), moduleEndLine(3)],
			childModuleLine
		);

		expect(() =>
			resolveConstants({
				ast: { prototypes: [], modules: [childModule], constants: [env], functions: [] },
				projectConstantNamespaceScopes: [
					{ groupPath: '', passes: [] },
					{ groupPath: 'child', parentGroupPath: '', passes: [passLine(1, 'env')] },
				],
			})
		).toThrow('Undeclared identifier: RATE');
	});

	it('requires a namespace pass at every nested project boundary', () => {
		const envLine = constantsLine(1, 'env');
		const env = constantsAst(
			'env',
			[envLine, { diagnosticSource: { kind: 'document' }, lineNumber: 2, instruction: 'constantsEnd', arguments: [] }],
			envLine
		);

		expect(() =>
			resolveConstants({
				ast: { prototypes: [], modules: [], constants: [env], functions: [] },
				projectConstantNamespaceScopes: [
					{ groupPath: '', passes: [] },
					{ groupPath: 'child', parentGroupPath: '', passes: [] },
					{ groupPath: 'child/nested', parentGroupPath: 'child', passes: [passLine(1, 'env')] },
				],
			})
		).toThrowError(ConstantResolverErrorCode.UNRESOLVED_PASSED_NAMESPACE);
	});

	it('rejects a passed namespace that collides with a child namespace', () => {
		const envLine = constantsLine(1, 'env');
		const env = constantsAst(
			'env',
			[envLine, { diagnosticSource: { kind: 'document' }, lineNumber: 2, instruction: 'constantsEnd', arguments: [] }],
			envLine
		);
		const childEnvLine = moduleLine(1, 'child/env');
		const childEnv = moduleAst('child/env', [childEnvLine, moduleEndLine(2)], childEnvLine);

		expect(() =>
			resolveConstants({
				ast: { prototypes: [], modules: [childEnv], constants: [env], functions: [] },
				projectConstantNamespaceScopes: [
					{ groupPath: '', passes: [] },
					{ groupPath: 'child', parentGroupPath: '', passes: [passLine(1, 'env')] },
				],
			})
		).toThrowError(ConstantResolverErrorCode.DUPLICATE_NAMESPACE);
	});

	it('reports a root pass as an unresolved parent namespace', () => {
		expect(() =>
			resolveConstants({
				ast: { prototypes: [], modules: [], constants: [], functions: [] },
				projectConstantNamespaceScopes: [{ groupPath: '', passes: [passLine(1, 'env')] }],
			})
		).toThrowError(ConstantResolverErrorCode.UNRESOLVED_PASSED_NAMESPACE);
	});

	it('reports a child pass whose parent has no matching constants block', () => {
		expect(() =>
			resolveConstants({
				ast: { prototypes: [], modules: [], constants: [], functions: [] },
				projectConstantNamespaceScopes: [
					{ groupPath: '', passes: [] },
					{ groupPath: 'child', parentGroupPath: '', passes: [passLine(1, 'env')] },
				],
			})
		).toThrowError(ConstantResolverErrorCode.UNRESOLVED_PASSED_NAMESPACE);
	});

	it('does not pass module constant namespaces', () => {
		const rootModuleLine = moduleLine(1, 'env');
		const rootModule = moduleAst(
			'env',
			[rootModuleLine, constLine(2, 'RATE', literal(48_000)), moduleEndLine(3)],
			rootModuleLine
		);
		expect(() =>
			resolveConstants({
				ast: { prototypes: [], modules: [rootModule], constants: [], functions: [] },
				projectConstantNamespaceScopes: [
					{ groupPath: '', passes: [] },
					{ groupPath: 'child', parentGroupPath: '', passes: [passLine(1, 'env')] },
				],
			})
		).toThrowError(ConstantResolverErrorCode.UNRESOLVED_PASSED_NAMESPACE);
	});

	it('keeps AST lines immutable while reporting resolved constant arguments', () => {
		const sharedLine = constantsLine(10, 'SHARED');
		const sharedConstLine = constLine(11, 'SIZE', literal(8));
		const sharedAst = constantsAst(
			'SHARED',
			[
				sharedLine,
				sharedConstLine,
				{ diagnosticSource: { kind: 'document' }, lineNumber: 12, instruction: 'constantsEnd', arguments: [] },
			],
			sharedLine
		);
		const mainLine = moduleLine(20, 'main');
		const useSharedLine = useLine(21, 'SHARED');
		const pushSizeLine = pushLine(22, id('SIZE', 'constant'));
		const mainAst = moduleAst('main', [mainLine, useSharedLine, pushSizeLine, moduleEndLine(23)], mainLine);

		const result = resolveConstants({
			ast: {
				prototypes: [],
				modules: [mainAst],
				constants: [sharedAst],
				functions: [],
			},
		});

		expect(mainAst.lines[1]).toBe(useSharedLine);
		expect(mainAst.lines[2]).toBe(pushSizeLine);
		expect(useSharedLine.arguments[0]).toEqual(id('SHARED', 'constant'));
		expect(sharedConstLine.arguments[0]).toEqual(id('SIZE', 'constant'));
		expect(pushSizeLine.arguments[0]).toEqual(id('SIZE', 'constant'));
		expect(result).toMatchSnapshot();
	});

	it('folds pure constant expressions and only substitutes resolvable operands in memory expressions', () => {
		const mainLine = moduleLine(1, 'main');
		const sizeTimesElementSize = expression(id('SIZE', 'constant'), '*', sizeofId('buffer'));
		const literalExpression = expression(literal(2), '*', literal(3));
		const ast = moduleAst(
			'main',
			[
				mainLine,
				constLine(2, 'SIZE', literal(4)),
				pushLine(3, sizeTimesElementSize),
				pushLine(4, literalExpression),
				moduleEndLine(5),
			],
			mainLine
		);

		const result = resolveConstants({
			ast: {
				prototypes: [],
				modules: [ast],
				constants: [],
				functions: [],
			},
		});

		expect(ast.lines[2].arguments[0]).toBe(sizeTimesElementSize);
		expect(result.references.modules[0].lineFacts[2]).toEqual({
			arguments: [
				{
					...sizeTimesElementSize,
					left: literal(4),
				},
			],
		});
		expect(result.references.modules[0].lineFacts[3]).toEqual({
			arguments: [literal(6)],
		});
	});

	it('applies explicit rounding after resolving constant expressions', () => {
		const mainLine = moduleLine(1, 'main');
		const ast = moduleAst(
			'main',
			[
				mainLine,
				constLine(2, 'ROUNDED_UP', expression(literal(3), '/', literal(2), 'round')),
				constLine(3, 'ROUNDED_DOWN', expression(literal(-3), '/', literal(2), 'round')),
				constLine(4, 'FLOORED', roundedOperand(literal(1.9), 'floor')),
				constLine(5, 'CEILED', roundedOperand(literal(1.1), 'ceil')),
				moduleEndLine(6),
			],
			mainLine
		);

		const result = resolveConstants({
			ast: {
				prototypes: [],
				modules: [ast],
				constants: [],
				functions: [],
			},
		});

		expect(result.namespaces.main).toMatchObject({
			ROUNDED_UP: { value: 2, isInteger: true },
			ROUNDED_DOWN: { value: -2, isInteger: true },
			FLOORED: { value: 1, isInteger: true },
			CEILED: { value: 2, isInteger: true },
		});
	});

	it('throws when a constant declaration needs memory knowledge', () => {
		const mainLine = moduleLine(1, 'main');
		const ast = moduleAst('main', [mainLine, constLine(2, 'BAD', sizeofId('buffer')), moduleEndLine(3)], mainLine);

		expect(() =>
			resolveConstants({
				ast: {
					prototypes: [],
					modules: [ast],
					constants: [],
					functions: [],
				},
			})
		).toThrowError(CompilerError);
		expect(() =>
			resolveConstants({
				ast: {
					prototypes: [],
					modules: [ast],
					constants: [],
					functions: [],
				},
			})
		).toThrowError(ConstantResolverErrorCode.UNRESOLVED_CONSTANT_VALUE);
	});

	it('throws when a used constants namespace cannot be collected', () => {
		const mainLine = moduleLine(1, 'main');
		const ast = moduleAst('main', [mainLine, useLine(2, 'MISSING'), moduleEndLine(3)], mainLine);

		expect(() =>
			resolveConstants({
				ast: {
					prototypes: [],
					modules: [ast],
					constants: [],
					functions: [],
				},
			})
		).toThrowError(CompilerError);
		expect(() =>
			resolveConstants({
				ast: {
					prototypes: [],
					modules: [ast],
					constants: [],
					functions: [],
				},
			})
		).toThrowError(ConstantResolverErrorCode.UNRESOLVED_NAMESPACE);
	});

	it('throws when a module and constants block share a constant namespace id', () => {
		const sharedConstantsLine = constantsLine(1, 'shared');
		const constants = constantsAst(
			'shared',
			[
				sharedConstantsLine,
				constLine(2, 'VALUE', literal(1)),
				{ diagnosticSource: { kind: 'document' }, lineNumber: 3, instruction: 'constantsEnd', arguments: [] },
			],
			sharedConstantsLine
		);
		const sharedModuleLine = moduleLine(4, 'shared');
		const module = moduleAst('shared', [sharedModuleLine, moduleEndLine(5)], sharedModuleLine);

		expect(() =>
			resolveConstants({
				ast: {
					prototypes: [],
					modules: [module],
					constants: [constants],
					functions: [],
				},
			})
		).toThrowError(CompilerError);
		expect(() =>
			resolveConstants({
				ast: {
					prototypes: [],
					modules: [module],
					constants: [constants],
					functions: [],
				},
			})
		).toThrowError(ConstantResolverErrorCode.DUPLICATE_NAMESPACE);
	});
});
