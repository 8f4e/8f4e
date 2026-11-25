import { describe, expect, it } from 'vitest';
import { syntaxFonts } from './__tests__/testUtils';
import highlightSyntax from './highlightSyntax';

describe('highlightSyntax', () => {
	it('treats typed note content as ordinary note text', () => {
		const result = highlightSyntax(['note custom', 'uniform float value'], 'note', syntaxFonts);

		expect(result[1][0]).toBe('comment');
	});

	it('selects note highlighting for regular notes', () => {
		const result = highlightSyntax(['note', 'uniform float value'], 'note', syntaxFonts);

		expect(result[1][0]).toBe('comment');
	});
});
