import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { compileToAST, parseLine, SyntaxErrorCode } from '../src';

describe.each(['café', 'value🚀'])('non-ASCII entity name %s', name => {
	it.each([
		{ code: [`function ${name}`, '#export', 'push 7', 'functionEnd int'], lineNumber: 0, instruction: 'function' },
		{ code: ['function example', `#export ${name}`, 'functionEnd'], lineNumber: 1, instruction: '#export' },
		{ code: ['function example', `param int ${name}`, 'functionEnd'], lineNumber: 1, instruction: 'param' },
		{ code: ['function example', `local int ${name}`, 'functionEnd'], lineNumber: 1, instruction: 'local' },
		{ code: ['module example', `int ${name} 7`, 'moduleEnd'], lineNumber: 1, instruction: 'int' },
		{ code: ['module example', `int* ${name}`, 'moduleEnd'], lineNumber: 1, instruction: 'int*' },
		{ code: ['module example', `int[] ${name} 2`, 'moduleEnd'], lineNumber: 1, instruction: 'int[]' },
		{ code: [`prototype ${name}`, 'int value', 'prototypeEnd'], lineNumber: 0, instruction: 'prototype' },
		{ code: [`constants ${name}`, 'const VALUE 7', 'constantsEnd'], lineNumber: 0, instruction: 'constants' },
		{
			code: ['constants example', `const ${name.toUpperCase()} 7`, 'constantsEnd'],
			lineNumber: 1,
			instruction: 'const',
		},
	])('rejects the $instruction declaration with its source line', ({ code, lineNumber, instruction }) => {
		expect(() => compileToAST(code)).toThrowError(
			expect.objectContaining({
				name: 'SyntaxRulesError',
				code: SyntaxErrorCode.INVALID_IDENTIFIER,
				line: expect.objectContaining({ lineNumber, instruction }),
			})
		);
	});

	it.each([
		name,
		`&${name}`,
		`*${name}`,
		`sizeof(${name})`,
		`count(*${name})`,
		`other:${name}`,
		`${name}:value`,
		`&${name}:`,
		`max(other:${name})`,
		`${name.toUpperCase()}*2`,
		`2/${name.toUpperCase()}`,
		`floor(sizeof(${name})/2)`,
	])('rejects the reference %s with its source line', reference => {
		expect(() => parseLine(`push ${reference}`, 9)).toThrowError(
			expect.objectContaining({
				name: 'SyntaxRulesError',
				code: SyntaxErrorCode.INVALID_IDENTIFIER,
				line: expect.objectContaining({ lineNumber: 9, instruction: 'push' }),
			})
		);
	});
});

describe('ASCII entity names', () => {
	it.each([
		['function compute!$', '#export result!$', 'param int input!$', 'local int saved!$', 'functionEnd'],
		['module _example_1', 'int value!$ 7', 'int* pointer!$ &value!$', 'int[] samples!$ 2', 'moduleEnd'],
		['prototype state!$', 'int field!$', 'prototypeEnd'],
		['constants config!$', 'const VALUE!$_0 7', 'constantsEnd'],
	])('preserves existing naming conventions in %s', (...code) => {
		expect(() => compileToAST(code)).not.toThrow();
	});

	it.each(['value!$', '&value!$', '*pointer!$', 'other:value!$', 'sizeof(value!$)', 'VALUE!$_0*2'])(
		'accepts the reference %s',
		reference => {
			expect(() => parseLine(`push ${reference}`, 0)).not.toThrow();
		}
	);

	it('keeps Unicode string literals separate from identifiers', () => {
		expect(parseLine('push "café 🚀"', 3).arguments).toEqual([{ type: ArgumentType.STRING_LITERAL, value: 'café 🚀' }]);
	});

	it('preserves constant capitalization rules', () => {
		expect(() => compileToAST(['constants config', 'const lowerCase 7', 'constantsEnd'])).toThrowError(
			expect.objectContaining({ code: SyntaxErrorCode.INVALID_ARGUMENT })
		);
	});
});
