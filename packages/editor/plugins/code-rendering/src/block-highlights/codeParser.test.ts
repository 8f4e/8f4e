import { describe, expect, it } from 'vitest';

import parseCodeBlock from './codeParser';

describe('parseCodeBlock', () => {
	it('returns empty array when no block instructions exist', () => {
		const code = ['push 1', 'add', 'store'];

		expect(parseCodeBlock(code)).toEqual([]);
	});

	it('parses simple blocks and records start/end positions', () => {
		const code = ['if condition', 'add', 'ifEnd'];

		expect(parseCodeBlock(code)).toEqual([
			{
				startInstruction: 'if',
				endInstruction: 'ifEnd',
				startLineNumber: 0,
				endLineNumber: 2,
				depth: 0,
			},
		]);
	});

	it('calculates depth for nested structures', () => {
		const code = ['if condition', 'loop counter 0 10', 'loopEnd', 'ifEnd'];

		expect(parseCodeBlock(code)).toEqual([
			{
				startInstruction: 'if',
				endInstruction: 'ifEnd',
				startLineNumber: 0,
				endLineNumber: 3,
				depth: 0,
			},
			{
				startInstruction: 'loop',
				endInstruction: 'loopEnd',
				startLineNumber: 1,
				endLineNumber: 2,
				depth: 1,
			},
		]);
	});

	it('leaves endLineNumber null when the block is never closed', () => {
		const code = ['loop counter 0 10', 'add'];

		expect(parseCodeBlock(code)).toEqual([
			{
				startInstruction: 'loop',
				endInstruction: 'loopEnd',
				startLineNumber: 0,
				endLineNumber: undefined,
				depth: 0,
			},
		]);
	});

	it('ignores unmatched end instructions', () => {
		const code = ['ifEnd', 'loopEnd'];

		expect(parseCodeBlock(code)).toEqual([]);
	});

	it('treats else as end of if branch and start of else branch', () => {
		const code = ['if condition', 'push 1', 'else', 'push 2', 'ifEnd'];

		expect(parseCodeBlock(code)).toEqual([
			{
				startInstruction: 'if',
				endInstruction: 'ifEnd',
				startLineNumber: 0,
				endLineNumber: 2,
				depth: 0,
			},
			{
				startInstruction: 'else',
				endInstruction: 'ifEnd',
				startLineNumber: 2,
				endLineNumber: 4,
				depth: 0,
			},
		]);
	});

	it('ignores else when there is no open if block', () => {
		const code = ['else', 'push 1', 'ifEnd'];

		expect(parseCodeBlock(code)).toEqual([]);
	});

	it('matches else to the nearest open if in nested blocks', () => {
		const code = ['if outer', 'if inner', 'push 1', 'else', 'push 2', 'ifEnd', 'ifEnd'];

		expect(parseCodeBlock(code)).toEqual([
			{
				startInstruction: 'if',
				endInstruction: 'ifEnd',
				startLineNumber: 0,
				endLineNumber: 6,
				depth: 0,
			},
			{
				startInstruction: 'if',
				endInstruction: 'ifEnd',
				startLineNumber: 1,
				endLineNumber: 3,
				depth: 1,
			},
			{
				startInstruction: 'else',
				endInstruction: 'ifEnd',
				startLineNumber: 3,
				endLineNumber: 5,
				depth: 1,
			},
		]);
	});

	it('skips inner if blocks already closed by ifEnd when matching an outer else', () => {
		const code = ['if outer', 'if inner', 'push 1', 'ifEnd', 'else', 'push 2', 'ifEnd'];

		expect(parseCodeBlock(code)).toEqual([
			{
				startInstruction: 'if',
				endInstruction: 'ifEnd',
				startLineNumber: 0,
				endLineNumber: 4,
				depth: 0,
			},
			{
				startInstruction: 'if',
				endInstruction: 'ifEnd',
				startLineNumber: 1,
				endLineNumber: 3,
				depth: 1,
			},
			{
				startInstruction: 'else',
				endInstruction: 'ifEnd',
				startLineNumber: 4,
				endLineNumber: 6,
				depth: 0,
			},
		]);
	});

	it('handles repeated else instructions by matching the next open if block', () => {
		const code = ['if outer', 'if inner', 'else', 'else', 'ifEnd', 'ifEnd'];

		expect(parseCodeBlock(code)).toEqual([
			{
				startInstruction: 'if',
				endInstruction: 'ifEnd',
				startLineNumber: 0,
				endLineNumber: 3,
				depth: 0,
			},
			{
				startInstruction: 'if',
				endInstruction: 'ifEnd',
				startLineNumber: 1,
				endLineNumber: 2,
				depth: 1,
			},
			{
				startInstruction: 'else',
				endInstruction: 'ifEnd',
				startLineNumber: 2,
				endLineNumber: 5,
				depth: 1,
			},
			{
				startInstruction: 'else',
				endInstruction: 'ifEnd',
				startLineNumber: 3,
				endLineNumber: 4,
				depth: 0,
			},
		]);
	});

	it('matches closing instructions behind differently typed open blocks and tracks open depth', () => {
		const code = ['if cond', 'loop i 0 5', 'ifEnd', 'block', 'blockEnd', 'loopEnd', 'if after', 'ifEnd'];

		expect(parseCodeBlock(code)).toEqual([
			{
				startInstruction: 'if',
				endInstruction: 'ifEnd',
				startLineNumber: 0,
				endLineNumber: 2,
				depth: 0,
			},
			{
				startInstruction: 'loop',
				endInstruction: 'loopEnd',
				startLineNumber: 1,
				endLineNumber: 5,
				depth: 1,
			},
			{
				startInstruction: 'block',
				endInstruction: 'blockEnd',
				startLineNumber: 3,
				endLineNumber: 4,
				depth: 1,
			},
			{
				startInstruction: 'if',
				endInstruction: 'ifEnd',
				startLineNumber: 6,
				endLineNumber: 7,
				depth: 0,
			},
		]);
	});
});
