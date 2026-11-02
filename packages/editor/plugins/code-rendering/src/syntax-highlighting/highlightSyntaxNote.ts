import highlightEditorDirective from './highlightEditorDirective';
import type { SyntaxFonts, SyntaxHighlighting } from './types';

export default function highlightSyntaxNote<T>(code: string[], fonts: SyntaxFonts<T>): SyntaxHighlighting<T> {
	return code.map((line, sourceLineIndex) => {
		const colors = new Array<T | undefined>(line.length).fill(undefined);
		const delimiter = /^\s*(note|noteEnd)(?=\s|$)/.exec(line);
		if (delimiter && (sourceLineIndex === 0 || delimiter[1] === 'noteEnd')) {
			const start = delimiter[0].length - delimiter[1].length;
			colors[start] = fonts.fontInstruction;
			if (start + delimiter[1].length < line.length) colors[start + delimiter[1].length] = fonts.fontCode;
			return colors;
		}
		if (line.length > 0) colors[0] = fonts.fontCodeComment;
		highlightEditorDirective(line, colors, fonts.fontCode, fonts.fontCodeComment);
		return colors;
	});
}
