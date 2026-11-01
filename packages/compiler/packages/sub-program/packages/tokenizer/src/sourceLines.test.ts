import { describe, expect, it } from 'vitest';
import { foldArgumentContinuationLines } from './sourceLines';
import { SyntaxErrorCode } from './syntax/syntaxError';

describe('foldArgumentContinuationLines', () => {
	it.each([{ code: [] }, { code: ['', ' ', '\t', '; comment', '  ; indented comment'] }])(
		'returns no logical lines for $code',
		({ code }) => {
			expect(foldArgumentContinuationLines(code)).toEqual([]);
		}
	);

	it('filters comments and blanks while preserving instruction text and physical line numbers', () => {
		const code = ['; heading', '', '\tmodule test', '  ; comment', '\t', ' int value 1 ; default', 'moduleEnd'];

		expect(foldArgumentContinuationLines(code)).toEqual([
			{ line: '\tmodule test', lineNumber: 2 },
			{ line: ' int value 1 ; default', lineNumber: 5 },
			{ line: 'moduleEnd', lineNumber: 6 },
		]);
	});

	it('folds continuations across comments and blanks without changing the source', () => {
		const code = ['; heading', 'int[]', '; name', ' - values', '', '\t- 2', '  ; defaults', '- -1', '- 2', 'push 3'];
		const original = [...code];
		Object.freeze(code);

		expect(foldArgumentContinuationLines(code)).toEqual([
			{ line: 'int[] values 2 -1 2', lineNumber: 1 },
			{ line: 'push 3', lineNumber: 9 },
		]);
		expect(code).toEqual(original);
	});

	it('preserves quoted semicolons and removes inline comments from continuation arguments', () => {
		expect(foldArgumentContinuationLines(['push', ' - "hello; world" ; comment', 'drop'])).toEqual([
			{ line: 'push "hello; world"', lineNumber: 0 },
			{ line: 'drop', lineNumber: 2 },
		]);
	});

	it.each([
		{
			name: 'orphaned continuation',
			code: ['; heading', '', '  - 1'],
			codeNumber: SyntaxErrorCode.INVALID_ARGUMENT,
			message: 'Argument continuation has no instruction.',
			lineNumber: 2,
		},
		{
			name: 'bare continuation',
			code: ['push', '; comment', '', '-'],
			codeNumber: SyntaxErrorCode.MISSING_ARGUMENT,
			message: 'Missing argument for continuation.',
			lineNumber: 3,
		},
		{
			name: 'comment-only continuation',
			code: ['push', '; comment', '', '\t- ; no argument'],
			codeNumber: SyntaxErrorCode.MISSING_ARGUMENT,
			message: 'Missing argument for continuation.',
			lineNumber: 3,
		},
		{
			name: 'continuation with multiple arguments',
			code: ['push', '; comment', '', ' - 1 2'],
			codeNumber: SyntaxErrorCode.INVALID_ARGUMENT,
			message: 'Argument continuation accepts exactly one argument.',
			lineNumber: 3,
		},
	])('preserves diagnostics and source for a $name', ({ code, codeNumber, message, lineNumber }) => {
		const original = [...code];
		Object.freeze(code);

		expect(() => foldArgumentContinuationLines(code)).toThrowError(
			expect.objectContaining({
				name: 'SyntaxRulesError',
				code: codeNumber,
				message,
				line: { lineNumber, instruction: '-' },
			})
		);
		expect(code).toEqual(original);
	});
});
