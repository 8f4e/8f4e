import { describe, expect, it } from 'vitest';

import instructionParser from './instructionParser';

describe('instructionParser', () => {
	it('captures instruction and arguments', () => {
		const match = 'push 1 2 3'.match(instructionParser);
		expect(match?.slice(1, 3)).toEqual(['push', '1 2 3']);
	});

	it('captures arbitrary-length argument lists', () => {
		const match = 'int[] notes 10 48 50 53 55 57 60 62 64 65'.match(instructionParser);
		expect(match?.slice(1, 3)).toEqual(['int[]', 'notes 10 48 50 53 55 57 60 62 64 65']);
	});

	it('ignores trailing semicolon comments', () => {
		const match = 'add 1 2 ; comment'.match(instructionParser);
		expect(match?.[1]).toBe('add');
		expect(match?.[2]).toBe('1 2');
	});

	it('treats hash as part of argument, not a comment', () => {
		const match = 'add 1 2 # comment'.match(instructionParser);
		expect(match?.[1]).toBe('add');
		expect(match?.[2]).toBe('1 2 # comment');
	});
});
