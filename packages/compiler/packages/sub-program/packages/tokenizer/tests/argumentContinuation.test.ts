import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { compileToAST, SyntaxErrorCode } from '../src';

describe('argument continuations with inline comments', () => {
	it.each(['push ; explanatory comment', 'push; explanatory comment'])(
		'keeps the continued argument after %s',
		instruction => {
			const ast = compileToAST(['module test', instruction, '- 7 ; argument comment', 'moduleEnd']);

			expect(ast.lines[1]).toMatchObject({
				instruction: 'push',
				lineNumber: 1,
				arguments: [{ type: ArgumentType.LITERAL, value: 7, isInteger: true }],
			});
		}
	);

	it('keeps multiple continued arguments when each physical line has a comment', () => {
		const ast = compileToAST([
			'module test',
			'int[]; array declaration',
			'- values ; name',
			'- 2; element count',
			'- 7 ; first value',
			'- 9; second value',
			'moduleEnd',
		]);

		expect(ast.lines[1]).toMatchObject({
			instruction: 'int[]',
			lineNumber: 1,
			arguments: [
				{ type: ArgumentType.IDENTIFIER, value: 'values' },
				{ type: ArgumentType.LITERAL, value: 2, isInteger: true },
				{ type: ArgumentType.LITERAL, value: 7, isInteger: true },
				{ type: ArgumentType.LITERAL, value: 9, isInteger: true },
			],
		});
	});

	it.each([
		{ source: '- "hello; world" ; argument comment', value: 'hello; world' },
		{
			source: String.raw`- "say \"hello; world\" at C:\\tmp"; argument comment`,
			value: String.raw`say "hello; world" at C:\tmp`,
		},
	])('preserves quoted continuation contents in $source', ({ source, value }) => {
		const ast = compileToAST(['module test', 'push; instruction comment', source, 'moduleEnd']);

		expect(ast.lines[1].arguments).toEqual([{ type: ArgumentType.STRING_LITERAL, value }]);
	});

	it('preserves semicolons and escapes in an existing argument before appending another', () => {
		const ast = compileToAST([
			'module test',
			String.raw`call inspect "say \"hello; world\" at C:\\tmp"; instruction comment`,
			'- 7 ; argument comment',
			'moduleEnd',
		]);

		expect(ast.lines[1].arguments).toMatchObject([
			{ type: ArgumentType.IDENTIFIER, value: 'inspect' },
			{ type: ArgumentType.STRING_LITERAL, value: String.raw`say "hello; world" at C:\tmp` },
			{ type: ArgumentType.LITERAL, value: 7, isInteger: true },
		]);
	});

	it('keeps physical line numbers after comments and continuation lines are folded', () => {
		const ast = compileToAST([
			'module test',
			'; before the instruction',
			'push ; instruction comment',
			'- 7 ; argument comment',
			'; after the continuation',
			'drop',
			'moduleEnd',
		]);

		expect(ast.lines.map(line => line.lineNumber)).toEqual([0, 2, 5, 6]);
		expect(ast.lines[1].arguments).toEqual([{ type: ArgumentType.LITERAL, value: 7, isInteger: true }]);
	});

	it.each([
		{
			name: 'bare continuation',
			source: ['module test', 'push ; comment', '-', 'moduleEnd'],
			code: SyntaxErrorCode.MISSING_ARGUMENT,
			lineNumber: 2,
		},
		{
			name: 'comment-only continuation with a space',
			source: ['module test', 'push ; comment', '- ; no argument', 'moduleEnd'],
			code: SyntaxErrorCode.MISSING_ARGUMENT,
			lineNumber: 2,
		},
		{
			name: 'comment-only continuation without a space',
			source: ['module test', 'push ; comment', '-; no argument', 'moduleEnd'],
			code: SyntaxErrorCode.MISSING_ARGUMENT,
			lineNumber: 2,
		},
		{
			name: 'multiple arguments on one continuation',
			source: ['module test', 'push ; comment', '- 7 9 ; two arguments', 'moduleEnd'],
			code: SyntaxErrorCode.INVALID_ARGUMENT,
			lineNumber: 2,
		},
		{
			name: 'orphaned continuation after a comment',
			source: ['; no preceding instruction', '- 7 ; argument comment'],
			code: SyntaxErrorCode.INVALID_ARGUMENT,
			lineNumber: 1,
		},
	])('keeps the error and source line for a $name', ({ source, code, lineNumber }) => {
		expect(() => compileToAST(source)).toThrow(
			expect.objectContaining({ code, line: expect.objectContaining({ lineNumber, instruction: '-' }) })
		);
	});
});
