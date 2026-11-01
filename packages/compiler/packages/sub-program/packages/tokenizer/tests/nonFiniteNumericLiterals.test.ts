import { describe, expect, it } from 'vitest';
import { compileToAST, SyntaxErrorCode } from '../src';

describe('non-finite radix literal diagnostics', () => {
	it.each([
		['positive hexadecimal', `0x${'f'.repeat(260)}`],
		['negative hexadecimal', `-0x${'f'.repeat(260)}`],
		['positive binary', `0b${'1'.repeat(1025)}`],
		['negative binary', `-0b${'1'.repeat(1025)}`],
	])('reports the source line for an overflowing %s literal', (_name, token) => {
		expect(() => compileToAST(['function example', '#export answer', `push ${token}`, 'functionEnd int'])).toThrowError(
			expect.objectContaining({
				name: 'SyntaxRulesError',
				code: SyntaxErrorCode.INVALID_NUMERIC_LITERAL,
				line: expect.objectContaining({ lineNumber: 2, instruction: 'push' }),
			})
		);
	});
});
