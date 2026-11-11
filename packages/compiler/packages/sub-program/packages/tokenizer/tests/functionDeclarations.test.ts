import { describe, expect, it } from 'vitest';
import { compileToAST, SyntaxErrorCode } from '../src';

describe('function declaration syntax', () => {
	it.each([
		{
			name: 'param after a local declaration',
			body: 'local int temporary',
			parameter: 'param int value',
			instruction: 'param',
		},
		{
			name: 'param after an executable instruction',
			body: 'push 1',
			parameter: 'param int value',
			instruction: 'param',
		},
		{
			name: 'paramShape after a local declaration',
			body: 'local int temporary',
			parameter: 'paramShape state',
			instruction: 'paramShape',
		},
		{
			name: 'paramShape after an executable instruction',
			body: 'push 1',
			parameter: 'paramShape state',
			instruction: 'paramShape',
		},
	])('rejects $name', ({ body, parameter, instruction }) => {
		expect(() => compileToAST(['function example', body, parameter, 'functionEnd'], { kind: 'document' })).toThrowError(
			expect.objectContaining({
				diagnostic: expect.objectContaining({
					code: SyntaxErrorCode.PARAM_AFTER_FUNCTION_BODY,
					instruction: instruction,
					location: expect.objectContaining({ lineNumber: 2 }),
				}),
			})
		);
	});

	it.each([
		{ first: '#export', second: '#export' },
		{ first: '#export first', second: '#export second' },
		{ first: '#export same', second: '#export same' },
	])('rejects $first followed by $second', ({ first, second }) => {
		expect(() => compileToAST(['function example', first, second, 'functionEnd'], { kind: 'document' })).toThrowError(
			expect.objectContaining({
				diagnostic: expect.objectContaining({
					code: SyntaxErrorCode.DUPLICATE_FUNCTION_EXPORT,
					instruction: '#export',
					location: expect.objectContaining({ lineNumber: 2 }),
				}),
			})
		);
	});

	it.each([
		{ first: '#import first', second: '#import second' },
		{ first: '#import "host.read"', second: '#import "host.read"' },
	])('rejects $first followed by $second', ({ first, second }) => {
		expect(() => compileToAST(['function example', first, second, 'functionEnd'], { kind: 'document' })).toThrowError(
			expect.objectContaining({
				diagnostic: expect.objectContaining({
					code: SyntaxErrorCode.DUPLICATE_FUNCTION_IMPORT,
					instruction: '#import',
					location: expect.objectContaining({ lineNumber: 2 }),
				}),
			})
		);
	});

	it.each([
		{ first: '#import read', second: '#export read', instruction: '#export' },
		{ first: '#export read', second: '#import read', instruction: '#import' },
	])('rejects $first followed by $second', ({ first, second, instruction }) => {
		expect(() => compileToAST(['function example', first, second, 'functionEnd'], { kind: 'document' })).toThrowError(
			expect.objectContaining({
				diagnostic: expect.objectContaining({
					code: SyntaxErrorCode.IMPORT_EXPORT_CONFLICT,
					instruction: instruction,
					location: expect.objectContaining({ lineNumber: 2 }),
				}),
			})
		);
	});

	it.each([
		{ body: ['push 1'], instruction: 'push' },
		{ body: ['load'], instruction: 'load' },
		{ body: ['call missing'], instruction: 'call' },
		{ body: ['local int temporary'], instruction: 'local' },
		{ body: ['loop', 'loopEnd'], instruction: 'loop' },
	])('rejects $instruction in an imported function', ({ body, instruction }) => {
		expect(() =>
			compileToAST(['function example', '#import read', ...body, 'functionEnd'], { kind: 'document' })
		).toThrowError(
			expect.objectContaining({
				diagnostic: expect.objectContaining({
					code: SyntaxErrorCode.IMPORTED_FUNCTION_BODY,
					instruction: instruction,
					location: expect.objectContaining({ lineNumber: 2 }),
				}),
			})
		);
	});

	it('preserves export metadata with parameters before locals and executable instructions', () => {
		const ast = compileToAST(
			[
				'function increment',
				'#export addOne',
				'param int value',
				'local int temporary',
				'push value',
				'push 1',
				'add',
				'functionEnd int',
			],
			{ kind: 'document' }
		);
		expect(ast).toMatchObject({
			type: 'function',
			name: 'increment',
			exportLine: { instruction: '#export', arguments: [{ value: 'addOne' }] },
			functionEndLine: { instruction: 'functionEnd', arguments: [{ value: 'int' }] },
		});
	});

	it('accepts an imported signature with prologue directives and unresolved paramShape', () => {
		const ast = compileToAST(
			[
				'function read',
				'#import "host.read"',
				'#impure',
				'#loopCap 4',
				'param int address',
				'paramShape state',
				'functionEnd int',
			],
			{ kind: 'document' }
		);
		expect(ast).toMatchObject({
			type: 'function',
			importLine: { instruction: '#import', arguments: [{ value: 'host.read' }] },
			functionEndLine: { instruction: 'functionEnd', arguments: [{ value: 'int' }] },
		});
		expect(ast.lines.find(line => line.instruction === 'paramShape')).toMatchObject({
			arguments: [{ value: 'state' }],
		});
	});

	it('accepts parameters after constant declarations that do not start the function body', () => {
		expect(() =>
			compileToAST(['function example', 'const VALUE 1', 'param int value', 'push value', 'functionEnd int'], {
				kind: 'document',
			})
		).not.toThrow();
	});

	it('leaves export-name uniqueness between functions to namespace validation', () => {
		const first = compileToAST(['function first', '#export shared', 'functionEnd'], { kind: 'document' });
		const second = compileToAST(['function second', '#export shared', 'functionEnd'], { kind: 'document' });
		expect(first).toMatchObject({ name: 'first', exportLine: { arguments: [{ value: 'shared' }] } });
		expect(second).toMatchObject({ name: 'second', exportLine: { arguments: [{ value: 'shared' }] } });
	});
});
