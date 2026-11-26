import { PROJECT_BLOCK_DELIMITERS } from './delimiters';

export type ProjectBlockOpener = (typeof PROJECT_BLOCK_DELIMITERS)[number]['opener'];

const closerByOpener = new Map<string, string>(PROJECT_BLOCK_DELIMITERS.map(({ opener, closer }) => [opener, closer]));
const openerByCloser = new Map<string, string>(PROJECT_BLOCK_DELIMITERS.map(({ opener, closer }) => [closer, opener]));

/**
 * Checks whether a trimmed line starts with an instruction keyword boundary.
 *
 * @param line - Trimmed project line to inspect.
 * @param instruction - Instruction keyword to match.
 * @returns True when the line is the instruction or starts with it followed by whitespace.
 */
export function startsWithInstruction(line: string, instruction: string): boolean {
	const nextCharacter = line[instruction.length];
	return line === instruction || (line.startsWith(instruction) && (nextCharacter === ' ' || nextCharacter === '\t'));
}

/**
 * Gets project opener keyword.
 *
 * @param line - Source AST line being processed.
 * @returns Resolved project opener keyword.
 */
export function getProjectOpenerKeyword(line: string): ProjectBlockOpener | null {
	for (const { opener } of PROJECT_BLOCK_DELIMITERS) {
		if (startsWithInstruction(line, opener)) {
			return opener;
		}
	}
	return null;
}

/**
 * Gets project closer keyword.
 *
 * @param line - Source AST line being processed.
 * @returns Resolved project closer keyword.
 */
export function getProjectCloserKeyword(line: string): string | null {
	for (const closer of openerByCloser.keys()) {
		if (startsWithInstruction(line, closer)) {
			return closer;
		}
	}
	return null;
}

/**
 * Gets expected project closer prefix.
 *
 * @param opener - Project block opener keyword.
 * @returns Resolved expected project closer prefix.
 */
export function getExpectedProjectCloserPrefix(opener: string): string {
	return closerByOpener.get(opener) ?? opener + 'End';
}
