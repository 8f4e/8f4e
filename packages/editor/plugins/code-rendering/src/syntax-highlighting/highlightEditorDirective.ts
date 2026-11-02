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
		if (directiveMatch.index === undefined) continue;

		const directiveStart = line.indexOf('@', directiveMatch.index);
		if (directiveStart === -1) continue;

		colors[directiveStart] = code;
		if (directiveStart + 1 < colors.length) colors[directiveStart + 1] = comment;
	}
}
