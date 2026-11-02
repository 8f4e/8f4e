import highlightEditorDirective from './highlightEditorDirective';
import type { SyntaxFonts, SyntaxHighlighting } from './types';

export default function highlightSyntaxNote<T>(code: string[], fonts: SyntaxFonts<T>): SyntaxHighlighting<T> {
	return code.map(line => {
		const colors = new Array<T | undefined>(line.length).fill(undefined);
		const trimmedLine = line.trim();
		if (trimmedLine === 'note' || trimmedLine === 'noteEnd') {
			const start = line.indexOf(trimmedLine);
			colors[start] = fonts.fontInstruction;
			if (start + trimmedLine.length < line.length) colors[start + trimmedLine.length] = fonts.fontCode;
			return colors;
		}
		if (line.length > 0) colors[0] = fonts.fontCodeComment;
		highlightEditorDirective(line, colors, fonts.fontCode, fonts.fontCodeComment);
		return colors;
	});
}
