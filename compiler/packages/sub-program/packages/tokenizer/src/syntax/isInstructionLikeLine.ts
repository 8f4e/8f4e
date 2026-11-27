import instructionParser from './instructionParser';

/**
 * Checks if a line has instruction-like syntax.
 * @param line - The line to validate.
 * @returns True if the line matches the instruction parser pattern, false otherwise.
 */
export default function isInstructionLikeLine(line: string): boolean {
	return instructionParser.test(line);
}
