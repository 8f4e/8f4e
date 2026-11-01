import { ArgumentType, isCompilerDirectiveLine, isMemoryDeclarationLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { compileToAST } from './index';
import { SyntaxErrorCode, SyntaxRulesError } from './syntax/syntaxError';

/** Compiles source through the production AST path and returns the parsed instruction stream. */
function compileLinesFromAST(code: string[]) {
	return compileToAST(code).lines;
}

describe('compileToAST', () => {
	it('rejects project-scope pass declarations inside compiler source blocks', () => {
		expect(() => compileToAST(['module synth', 'pass SAMPLE_RATE', 'moduleEnd'])).toThrow(
			expect.objectContaining({ code: SyntaxErrorCode.UNRECOGNISED_INSTRUCTION })
		);
	});

	it('constructs module metadata from the source-block parse path', () => {
		const ast = compileToAST([
			'module target',
			'#skipExecution',
			'int counter',
			'int sourceStart &source:buffer',
			'moduleEnd',
		]);

		expect(ast).toMatchObject({
			type: 'module',
			id: 'target',
			moduleLine: { instruction: 'module' },
		});
		if (ast.type !== 'module') {
			throw new Error('Expected module AST');
		}
		expect(ast.lines.find(line => line.instruction === '#skipExecution')).toMatchObject({
			instruction: '#skipExecution',
		});
		expect(ast.lines.filter(isMemoryDeclarationLine).map(line => line.arguments[0].value)).toEqual([
			'counter',
			'sourceStart',
		]);
	});

	it.each([
		{ moduleName: '1voice', errorCode: SyntaxErrorCode.INVALID_NUMERIC_LITERAL },
		{ moduleName: 'voice/left', errorCode: SyntaxErrorCode.INVALID_IDENTIFIER },
		{ moduleName: 'voice%left', errorCode: SyntaxErrorCode.INVALID_IDENTIFIER },
		{ moduleName: 'voice?left', errorCode: SyntaxErrorCode.INVALID_IDENTIFIER },
		{ moduleName: 'voice#left', errorCode: SyntaxErrorCode.INVALID_IDENTIFIER },
		{ moduleName: 'voice@left', errorCode: SyntaxErrorCode.INVALID_IDENTIFIER },
		{ moduleName: 'voice:left', errorCode: SyntaxErrorCode.INVALID_IDENTIFIER },
		{ moduleName: 'voice.left', errorCode: SyntaxErrorCode.INVALID_IDENTIFIER },
	])('rejects the invalid module name $moduleName through the production AST path', ({ moduleName, errorCode }) => {
		expect(() => compileToAST([`module ${moduleName}`, 'moduleEnd'])).toThrow(
			expect.objectContaining({ code: errorCode })
		);
	});

	it('keeps shape instructions in module lines without adding module metadata', () => {
		const ast = compileToAST(['module oscillator', 'shape oscillatorState', 'shape envelopeState', 'moduleEnd']);

		expect(ast).toMatchObject({
			type: 'module',
			id: 'oscillator',
		});
		if (ast.type !== 'module') {
			throw new Error('Expected module AST');
		}
		const shapeInstructionLines = ast.lines.filter(line => line.instruction === 'shape');
		expect(shapeInstructionLines.map(line => line.arguments[0].value)).toEqual(['oscillatorState', 'envelopeState']);
		expect(shapeInstructionLines.map(line => line.lineNumber)).toEqual([1, 2]);
	});

	it('constructs function metadata from the source-block parse path', () => {
		const ast = compileToAST([
			'const SCALE 2',
			'function mix',
			'#export mixExport',
			'param int left',
			'param float right',
			'push left',
			'functionEnd int float',
		]);

		expect(ast).toMatchObject({
			type: 'function',
			name: 'mix',
			functionLine: { instruction: 'function' },
			functionEndLine: { instruction: 'functionEnd' },
			exportLine: { instruction: '#export' },
		});
		expect(ast.lines[0].instruction).toBe('const');
	});

	it('keeps paramShape instructions in function lines', () => {
		const ast = compileToAST(['function mix', 'param int gain', 'paramShape mixerState', 'functionEnd int']);

		expect(ast).toMatchObject({
			type: 'function',
			name: 'mix',
		});
		if (ast.type !== 'function') {
			throw new Error('Expected function AST');
		}
		const paramShapeInstructionLines = ast.lines.filter(line => line.instruction === 'paramShape');
		expect(paramShapeInstructionLines.map(line => line.arguments[0].value)).toEqual(['mixerState']);
	});

	it('rejects memory declarations in function blocks', () => {
		expect(() => compileToAST(['function mix', 'int value', 'functionEnd'])).toThrow(
			expect.objectContaining({
				code: SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK,
				line: expect.objectContaining({
					lineNumber: 1,
					instruction: 'int',
				}),
			})
		);
	});

	it('rejects shape instructions outside module blocks based on language spec placement', () => {
		for (const code of [
			['shape oscillatorState'],
			['function mix', 'shape oscillatorState', 'functionEnd'],
			['prototype oscillatorState', 'shape oscillatorState', 'prototypeEnd'],
		]) {
			expect(() => compileToAST(code)).toThrow(
				expect.objectContaining({
					code: SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK,
					line: expect.objectContaining({
						instruction: 'shape',
					}),
				})
			);
		}
	});

	it('rejects paramShape instructions outside function blocks based on language spec placement', () => {
		for (const code of [
			['paramShape oscillatorState'],
			['module mix', 'paramShape oscillatorState', 'moduleEnd'],
			['prototype oscillatorState', 'paramShape oscillatorState', 'prototypeEnd'],
		]) {
			expect(() => compileToAST(code)).toThrow(
				expect.objectContaining({
					code: SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK,
					line: expect.objectContaining({
						instruction: 'paramShape',
					}),
				})
			);
		}
	});

	it('rejects source blocks nested inside source blocks', () => {
		for (const code of [
			['module synth', 'function helper', 'functionEnd', 'moduleEnd'],
			['function helper', 'module synth', 'moduleEnd', 'functionEnd'],
			['module synth', 'constants values', 'constantsEnd', 'moduleEnd'],
			['prototype shape', 'module synth', 'moduleEnd', 'prototypeEnd'],
		]) {
			expect(() => compileToAST(code)).toThrow(
				expect.objectContaining({
					code: SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK,
				})
			);
		}
	});

	it('rejects instructions that are not allowed in constants blocks', () => {
		expect(() => compileToAST(['constants values', 'push 1', 'constantsEnd'])).toThrow(
			expect.objectContaining({
				code: SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK,
				line: expect.objectContaining({
					lineNumber: 1,
					instruction: 'push',
				}),
			})
		);
	});

	it('rejects instructions that are not allowed in map blocks', () => {
		expect(() =>
			compileToAST(['module synth', 'mapBegin int', 'push 1', 'map 0 10', 'mapEnd int', 'moduleEnd'])
		).toThrow(
			expect.objectContaining({
				code: SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK,
				line: expect.objectContaining({
					lineNumber: 2,
					instruction: 'push',
				}),
			})
		);
	});

	it('rejects instructions outside their required parser block placement', () => {
		for (const code of [
			['module synth', 'loopIndex', 'moduleEnd'],
			['module synth', 'return', 'moduleEnd'],
			['function helper', 'exitIfTrue', 'functionEnd'],
		]) {
			expect(() => compileToAST(code)).toThrow(
				expect.objectContaining({
					code: SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK,
				})
			);
		}
	});

	it('rejects nested map blocks', () => {
		expect(() =>
			compileToAST([
				'module synth',
				'mapBegin int',
				'mapBegin int',
				'map 0 10',
				'mapEnd int',
				'mapEnd int',
				'moduleEnd',
			])
		).toThrow(
			expect.objectContaining({
				code: SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK,
				line: expect.objectContaining({
					lineNumber: 2,
					instruction: 'mapBegin',
				}),
			})
		);
	});

	it('allows loop nesting under modules, functions, and loops', () => {
		expect(() =>
			compileToAST(['function helper', 'loop', 'loop', 'loopIndex', 'loopEnd', 'loopEnd', 'functionEnd'])
		).not.toThrow();
	});

	it('constructs prototype metadata from the source-block parse path', () => {
		const ast = compileToAST(['prototype oscillatorState', 'float phase', 'float frequency 440', 'prototypeEnd']);

		expect(ast).toMatchObject({
			type: 'prototype',
			id: 'oscillatorState',
			prototypeLine: { instruction: 'prototype' },
		});
		if (ast.type !== 'prototype') {
			throw new Error('Expected prototype AST');
		}
		expect(ast.lines.filter(isMemoryDeclarationLine).map(line => line.arguments[0].value)).toEqual([
			'phase',
			'frequency',
		]);
	});

	it('allows constants namespace imports in prototype blocks', () => {
		const ast = compileToAST(['prototype oscillatorState', 'use env', 'float[] samples SAMPLE_COUNT', 'prototypeEnd']);

		expect(ast.lines[1]).toMatchObject({ instruction: 'use', arguments: [{ value: 'env' }] });
	});

	it('constructs imported function metadata from the source-block parse path', () => {
		const ast = compileToAST(['function hostLog', '#import "log.value"', 'param int value', 'functionEnd']);

		expect(ast).toMatchObject({
			type: 'function',
			name: 'hostLog',
			importLine: { instruction: '#import' },
		});
	});

	it('constructs constants metadata from the source-block parse path', () => {
		const ast = compileToAST(['constants sizes', 'const COUNT 4', 'constantsEnd']);

		expect(ast).toMatchObject({
			type: 'constants',
			id: 'sizes',
			constantsLine: { instruction: 'constants' },
		});
	});
});

describe('compileToAST line parsing', () => {
	it('folds dash argument continuation lines into the previous instruction', () => {
		const split = compileLinesFromAST(['module test', 'float*', '- readHead', '- &source:samples', 'moduleEnd']);
		const singleLine = compileLinesFromAST(['module test', 'float* readHead &source:samples', 'moduleEnd']);

		expect(split).toHaveLength(3);
		expect(split[1]).toEqual(singleLine[1]);
		expect(split[1]).toMatchObject({
			instruction: 'float*',
			arguments: [
				{ type: ArgumentType.IDENTIFIER, value: 'readHead' },
				{ type: ArgumentType.IDENTIFIER, value: '&source:samples' },
			],
		});
	});

	it('allows dash argument continuation after any source instruction', () => {
		const ast = compileLinesFromAST(['module test', 'push', '- 1', 'moduleEnd']);

		expect(ast[1]).toEqual(compileLinesFromAST(['module test', 'push 1', 'moduleEnd'])[1]);
	});

	it.each([
		{
			name: 'negative numeric literal',
			split: ['module test', 'push', '- -1', 'moduleEnd'],
			singleLine: ['module test', 'push -1', 'moduleEnd'],
		},
		{
			name: 'quoted string literal with spaces',
			split: ['module test', 'push', '- "hello world"', 'moduleEnd'],
			singleLine: ['module test', 'push "hello world"', 'moduleEnd'],
		},
		{
			name: 'compile-time expression',
			split: ['constants values', 'const SIZE', '- 2*4', 'constantsEnd'],
			singleLine: ['constants values', 'const SIZE 2*4', 'constantsEnd'],
		},
		{
			name: 'array declaration with hex and negative initializer values',
			split: ['module test', 'int[]', '- values', '- 4', '- 0xA8', '- -1', 'moduleEnd'],
			singleLine: ['module test', 'int[] values 4 0xA8 -1', 'moduleEnd'],
		},
	])('preserves $name continuation arguments', ({ split, singleLine }) => {
		expect(compileLinesFromAST(split)[1]).toEqual(compileLinesFromAST(singleLine)[1]);
	});

	it('rejects bare dash argument continuation lines', () => {
		expect(() => compileLinesFromAST(['module test', 'push 1', '-', 'moduleEnd'])).toThrow(
			expect.objectContaining({ code: SyntaxErrorCode.MISSING_ARGUMENT })
		);
	});

	it('rejects dash argument continuation lines with multiple arguments', () => {
		expect(() => compileLinesFromAST(['module test', 'push', '- 1 2', 'moduleEnd'])).toThrow(
			expect.objectContaining({ code: SyntaxErrorCode.INVALID_ARGUMENT })
		);
	});

	it('rejects dash argument continuation lines without a previous instruction', () => {
		expect(() => compileLinesFromAST(['- 1'])).toThrow(
			expect.objectContaining({ code: SyntaxErrorCode.INVALID_ARGUMENT })
		);
	});

	it('uses actual line numbers', () => {
		const ast = compileLinesFromAST(['module test', 'push 10', 'push 20', 'add', 'moduleEnd']);

		expect(ast).toHaveLength(5);
		expect(ast[0].lineNumber).toBe(0);
		expect(ast[1].lineNumber).toBe(1);
		expect(ast[2].lineNumber).toBe(2);
		expect(ast[3].lineNumber).toBe(3);
		expect(ast[4].lineNumber).toBe(4);
	});

	it('marks directives in module and function prologues', () => {
		const moduleAst = compileLinesFromAST(['module test', '#skipExecution', 'int counter', 'moduleEnd']);
		const functionAst = compileLinesFromAST([
			'function readValue',
			'#impure',
			'#export readValue',
			'param int address',
			'functionEnd int',
		]);

		expect(isCompilerDirectiveLine(moduleAst[1]) && moduleAst[1].isBlockPrologue).toBe(true);
		expect(isCompilerDirectiveLine(moduleAst[2])).toBe(false);
		expect(isCompilerDirectiveLine(functionAst[1]) && functionAst[1].isBlockPrologue).toBe(true);
		expect(isCompilerDirectiveLine(functionAst[2]) && functionAst[2].isBlockPrologue).toBe(true);
		expect(isCompilerDirectiveLine(functionAst[3])).toBe(false);
	});

	it('rejects module directives after the module prologue', () => {
		expect(() => compileLinesFromAST(['module test', 'int counter', '#skipExecution', 'moduleEnd'])).toThrow(
			expect.objectContaining({ code: SyntaxErrorCode.COMPILER_DIRECTIVE_MUST_BE_PROLOGUE })
		);
	});

	it('rejects function directives after the function prologue', () => {
		expect(() =>
			compileLinesFromAST(['function readValue', 'param int address', '#impure', 'functionEnd int'])
		).toThrow(expect.objectContaining({ code: SyntaxErrorCode.COMPILER_DIRECTIVE_MUST_BE_PROLOGUE }));
	});

	it('rejects directives nested inside non-prologue blocks', () => {
		expect(() => compileLinesFromAST(['module test', 'if', '#loopCap 20', 'ifEnd', 'moduleEnd'])).toThrow(
			expect.objectContaining({ code: SyntaxErrorCode.COMPILER_DIRECTIVE_MUST_BE_PROLOGUE })
		);
	});

	it('rejects directives before any module or function prologue', () => {
		expect(() => compileLinesFromAST(['#skipExecution'])).toThrow(
			expect.objectContaining({ code: SyntaxErrorCode.COMPILER_DIRECTIVE_MUST_BE_PROLOGUE })
		);
	});

	it('pairs if with ifEnd metadata without rewriting source arguments', () => {
		const ast = compileLinesFromAST(['module test', 'push 1', 'if', 'push 10', 'ifEnd int', 'moduleEnd']);

		expect(ast[2]).toMatchObject({
			instruction: 'if',
			arguments: [],
			ifBlock: {
				matchingIfEndIndex: 4,
				resultTypes: ['int'],
				hasElse: false,
			},
		});
		expect(ast[4]).toMatchObject({
			instruction: 'ifEnd',
			ifEndBlock: {
				matchingIfIndex: 2,
				resultTypes: ['int'],
			},
		});
	});

	it('pairs if with multi-result ifEnd metadata', () => {
		const ast = compileLinesFromAST([
			'module test',
			'push 1',
			'if',
			'push 10',
			'push 20',
			'ifEnd int float',
			'moduleEnd',
		]);

		expect(ast[2]).toMatchObject({
			instruction: 'if',
			arguments: [],
			ifBlock: {
				matchingIfEndIndex: 5,
				resultTypes: ['int', 'float'],
				hasElse: false,
			},
		});
		expect(ast[5]).toMatchObject({
			instruction: 'ifEnd',
			ifEndBlock: {
				matchingIfIndex: 2,
				resultTypes: ['int', 'float'],
			},
		});
	});

	it('tracks else on the paired if metadata', () => {
		const ast = compileLinesFromAST([
			'module test',
			'push 1',
			'if',
			'push 10',
			'else',
			'push 20',
			'ifEnd',
			'moduleEnd',
		]);

		expect(ast[2].ifBlock).toMatchObject({
			matchingIfEndIndex: 6,
			resultTypes: [],
			hasElse: true,
		});
	});

	it('rejects else without an open if block', () => {
		expect(() => compileLinesFromAST(['else'])).toThrowError(SyntaxRulesError);
	});

	it('rejects unclosed if blocks', () => {
		expect(() => compileLinesFromAST(['module test', 'push 1', 'if', 'push 10'])).toThrowError(SyntaxRulesError);
	});

	it('pairs block with blockEnd metadata without rewriting source arguments', () => {
		const ast = compileLinesFromAST(['module test', 'block', 'push 10', 'blockEnd int', 'moduleEnd']);

		expect(ast[1]).toMatchObject({
			instruction: 'block',
			arguments: [],
			blockBlock: {
				matchingBlockEndIndex: 3,
				resultTypes: ['int'],
			},
		});
		expect(ast[3]).toMatchObject({
			instruction: 'blockEnd',
			blockEndBlock: {
				matchingBlockIndex: 1,
				resultTypes: ['int'],
			},
		});
	});

	it('pairs block with blockEnd float metadata', () => {
		const ast = compileLinesFromAST(['module test', 'block', 'push 1.0', 'blockEnd float', 'moduleEnd']);

		expect(ast[1].blockBlock).toMatchObject({
			matchingBlockEndIndex: 3,
			resultTypes: ['float'],
		});
		expect(ast[3].blockEndBlock).toMatchObject({
			matchingBlockIndex: 1,
			resultTypes: ['float'],
		});
	});

	it('pairs bare block with bare blockEnd as no-result', () => {
		const ast = compileLinesFromAST(['module test', 'block', 'push 1', 'blockEnd', 'moduleEnd']);

		expect(ast[1].blockBlock).toMatchObject({
			matchingBlockEndIndex: 3,
			resultTypes: [],
		});
		expect(ast[3].blockEndBlock).toMatchObject({
			matchingBlockIndex: 1,
			resultTypes: [],
		});
	});

	it('rejects block with a type argument', () => {
		expect(() => compileLinesFromAST(['block int'])).toThrowError(SyntaxRulesError);
	});

	it('rejects blockEnd with an invalid type argument', () => {
		expect(() => compileLinesFromAST(['module test', 'block', 'blockEnd void', 'moduleEnd'])).toThrowError(
			SyntaxRulesError
		);
	});

	it('rejects unexpected blockEnd without a matching block', () => {
		expect(() => compileLinesFromAST(['blockEnd'])).toThrowError(SyntaxRulesError);
	});

	it('rejects unclosed block blocks', () => {
		expect(() => compileLinesFromAST(['module test', 'block', 'push 1'])).toThrowError(SyntaxRulesError);
	});

	it('exposes line location in block structure errors via the line property', () => {
		let thrownError: SyntaxRulesError | undefined;
		try {
			compileLinesFromAST(['module test', 'push 1', 'if', 'push 10']);
		} catch (error) {
			thrownError = error as SyntaxRulesError;
		}
		expect(thrownError).toBeInstanceOf(SyntaxRulesError);
		expect(thrownError?.line?.lineNumber).toBe(2);
		expect(thrownError?.line?.instruction).toBe('if');
	});
});
