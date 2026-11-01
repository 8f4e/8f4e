import { describe, expect, it } from 'vitest';
import { syntaxFonts } from './__tests__/testUtils';
import highlightSyntaxNote from './highlightSyntaxNote';

describe('highlightSyntaxNote', () => {
	it('renders note bodies as comments while keeping delimiters as instructions', () => {
		const result = highlightSyntaxNote(['note', 'todo', '; @pos 10 20', 'noteEnd'], syntaxFonts);

		expect(result[0][0]).toBe('instruction');
		expect(result[1][0]).toBe('comment');
		expect(result[2][0]).toBe('comment');
		expect(result[2][2]).toBe('code');
		expect(result[2][3]).toBe('comment');
		expect(result[3][0]).toBe('instruction');
	});

	it('preserves indentation while coloring note delimiters', () => {
		const result = highlightSyntaxNote(['  note', '\tindented body', '  noteEnd'], syntaxFonts);

		expect(result[0][2]).toBe('instruction');
		expect(result[1][0]).toBe('comment');
		expect(result[2][2]).toBe('instruction');
	});
});
