/**
 * Checks if a line contains the #skipExecution compiler directive.
 * @param line - The line to check.
 * @returns True if the line is a #skipExecution directive, false otherwise.
 */
export default function isSkipExecutionDirective(line: string): boolean {
	return /^\s*#skipExecution(?:\s+;.*|\s*)$/.test(line);
}
