import type { CodeBlockType } from '@8f4e/editor-state-types';
import highlightSyntax8f4e from './highlightSyntax8f4e';
import highlightSyntaxNote from './highlightSyntaxNote';
import type { SyntaxFonts, SyntaxHighlighting } from './types';

export default function highlightSyntax<T>(
	code: string[],
	blockType: CodeBlockType,
	fonts: SyntaxFonts<T>
): SyntaxHighlighting<T> {
	if (blockType !== 'note') return highlightSyntax8f4e(code, fonts);
	return highlightSyntaxNote(code, fonts);
}
