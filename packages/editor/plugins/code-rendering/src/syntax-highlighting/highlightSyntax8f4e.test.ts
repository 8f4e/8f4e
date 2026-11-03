import { describe, expect, it } from 'vitest';
import { syntaxFonts } from './__tests__/testUtils';
import highlightSyntax8f4e from './highlightSyntax8f4e';

describe('highlightSyntax8f4e', () => {
	it('highlights instructions, binary literals, comments, and editor directives', () => {
		const line = 'push 0b10 ; @watch value';
		const [colors] = highlightSyntax8f4e([line], syntaxFonts);

		expect(colors[0]).toBe('instruction');
		expect(colors[4]).toBe('code');
		expect(colors[5]).toBe('prefix');
		expect(colors[7]).toBe('one');
		expect(colors[8]).toBe('zero');
		expect(colors[10]).toBe('comment');
		expect(colors[12]).toBe('code');
		expect(colors[13]).toBe('comment');
	});

	it('does not highlight instructions or numbers inside comments', () => {
		const [colors] = highlightSyntax8f4e(['; push 0b10'], syntaxFonts);

		expect(colors[0]).toBe('comment');
		expect(colors.slice(1)).toEqual(new Array(colors.length - 1).fill(undefined));
	});

	it('highlights project group instructions', () => {
		const colors = highlightSyntax8f4e(['group audio', 'expose level &voice:level', 'groupEnd'], syntaxFonts);

		expect(colors.map(line => line[0])).toEqual(['instruction', 'instruction', 'instruction']);
	});
});
