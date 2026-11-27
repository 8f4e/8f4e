/**
 * Checks if a line is a comment (starts with semicolon after optional whitespace).
 * @param line - The line to check.
 * @returns True if the line is a comment, false otherwise.
 */
export default function isComment(line: string): boolean {
	return /^\s*;/.test(line);
}
