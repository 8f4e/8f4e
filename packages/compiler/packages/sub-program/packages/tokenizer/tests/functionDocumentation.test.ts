import type { ValidatedAST } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { compileToAST, createASTCache } from '../src';

const source = { kind: 'document' } as const;

describe('function documentation', () => {
	it('collects full-line tags and adjacent continuations separately from the instruction stream', () => {
		const ast = compileToAST(
			[
				'; @doc Outside the function.',
				'function example',
				'#export',
				'  ; @doc Returns the supplied value.',
				'  ; - The text may mention @pos or contain semicolons; and punctuation.',
				'; @param value The input.',
				'; - Preserves its type.',
				'; @returns',
				'; - The unchanged input.',
				'; ordinary comment',
				'; - Not attached to a tag.',
				'param int',
				'- value',
				'push value ; @doc An inline comment is not a documentation tag.',
				'functionEnd int',
				'; @doc Outside the function.',
			],
			source
		);
		expect(ast).toMatchObject({
			type: 'function',
			documentation: {
				description: 'Returns the supplied value. The text may mention @pos or contain semicolons; and punctuation.',
				parameters: { value: 'The input. Preserves its type.' },
				returns: 'The unchanged input.',
			},
			signature: { parameters: [{ name: 'value', type: 'int' }], returns: ['int'] },
		});
		expect(ast.lines.map(line => [line.instruction, line.lineNumber])).toEqual([
			['function', 1],
			['#export', 2],
			['param', 11],
			['push', 13],
			['functionEnd', 14],
		]);
	});

	it('ignores unknown parameters and empty tags and lets the last nonempty tag win', () => {
		const ast = compileToAST(
			[
				'function example',
				'; @doc Old description.',
				'; @doc New description.',
				'',
				'; - Not a continuation after a blank line.',
				'; @param outdated Stale parameter name.',
				'; - Still stale.',
				'; @param',
				'; @param value Old parameter description.',
				'; @param value',
				'; - Current parameter description.',
				'; @param value',
				'; @returns',
				'; @disabled',
				'; - Not return documentation.',
				'param int value',
				'functionEnd',
			],
			source
		);
		expect(ast.type === 'function' && ast.documentation).toEqual({
			description: 'New description.',
			parameters: { value: 'Current parameter description.' },
		});
	});

	it.each([
		{ code: ['module example', '; @doc Not a function.', 'moduleEnd'] },
		{
			code: [
				'function example',
				'; ordinary comment',
				'; @doc',
				'; @param missing Unused.',
				'; @returns',
				'functionEnd',
			],
		},
	])('omits metadata without function documentation: $code', ({ code }) => {
		expect(compileToAST(code, source)).not.toHaveProperty('documentation');
	});

	it('refreshes documentation on comment-only edits to a cached function', () => {
		const cache = createASTCache<ValidatedAST>();
		const code = ['function example', '; @doc Old text.', '; - Old continuation.', 'functionEnd'];
		const initial = compileToAST(code, source, cache, 'example');
		code[2] = '; - New continuation.';
		const updated = compileToAST(code, source, cache, 'example');
		expect(initial).toMatchObject({ documentation: { description: 'Old text. Old continuation.' } });
		expect(updated).toMatchObject({ documentation: { description: 'Old text. New continuation.' } });
		expect(updated.lines).toEqual(initial.lines);
		expect(compileToAST(code, source, cache, 'example')).toBe(updated);
	});
});
