import { describe, expect, it } from 'vitest';
import highlightEditorDirective from './highlightEditorDirective';

describe('highlightEditorDirective', () => {
	it('switches only editor directive markers back to code color', () => {
		const line = '; @pos 10 20';
		const colors = new Array(line.length).fill(undefined);
		colors[0] = 'comment';

		highlightEditorDirective(line, colors, 'code', 'comment');

		expect(colors[0]).toBe('comment');
		expect(colors[2]).toBe('code');
		expect(colors[3]).toBe('comment');
	});

	it('supports trailing and chained editor directives', () => {
		const line = 'push 1 ; @watch counter @testDirective';
		const colors = new Array(line.length).fill(undefined);
		colors[7] = 'comment';

		highlightEditorDirective(line, colors, 'code', 'comment');

		expect(colors[9]).toBe('code');
		expect(colors[10]).toBe('comment');
		expect(colors[24]).toBe('code');
		expect(colors[25]).toBe('comment');
	});
});
