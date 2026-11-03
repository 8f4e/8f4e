/** Insert text at the caret, preserving the surrounding source and returning the end of the insertion. */
export default function insertText(
	code: string[],
	row: number,
	col: number,
	text: string
): { code: string[]; row: number; col: number } {
	const lines = text.replace(/\r\n?/g, '\n').split('\n');
	const last = lines.length - 1;
	const endCol = last === 0 ? col + lines[0].length : lines[last].length;
	lines[0] = code[row].slice(0, col) + lines[0];
	lines[last] += code[row].slice(col);
	return {
		code: [...code.slice(0, row), ...lines, ...code.slice(row + 1)],
		row: row + last,
		col: endCol,
	};
}
