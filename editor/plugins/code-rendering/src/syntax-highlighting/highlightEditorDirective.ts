/**
 * Highlights only the `@` marker of editor directives as code. The directive
 * name and arguments retain the surrounding comment style.
 */
export default function highlightEditorDirective<T>(
	line: string,
	colors: Array<T | undefined>,
	code: T,
	comment: T
): void {
	for (const directiveMatch of line.matchAll(/(?:;|\s)@(?=\w+)/g)) {
		const directiveStart = directiveMatch.index + 1;

		colors[directiveStart] = code;
		colors[directiveStart + 1] = comment;
	}
}
