import { syntaxErrorAt } from '@8f4e/compiler-diagnostics';
import { isValidModuleName, MODULE_NAME_PATTERN } from '@8f4e/language-spec';
import { SyntaxErrorCode, syntaxErrorMessage } from '@8f4e/tokenizer';

/**
 * Reads the single required name from an entry opener.
 *
 * @param line - Project block opener line to parse.
 * @param lineNumber - One-based source line number for diagnostics.
 * @returns The parsed entry name.
 */
export function getEntryName(line: string, lineNumber: number): string {
	const [, ...args] = line.trim().split(/\s+/);
	const [blockName] = args;
	if (!blockName || args.length !== 1) {
		throw syntaxErrorAt(
			SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
			`Parse error at line ${lineNumber}: entry requires exactly one name`,
			{ kind: 'document' },
			{ lineNumber: lineNumber - 1 }
		);
	}
	return blockName;
}

/** Parses a group opener, without changing its raw source or resolving its optional template reference. */
export function parseGroupHeader(line: string, lineNumber: number): { name: string; template?: string } {
	const [, name, clause, template, ...extra] = line.split(';', 1)[0].trim().split(/\s+/);
	if (!name || (clause !== undefined && clause !== 'use') || extra.length) {
		throw syntaxErrorAt(
			SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
			`Parse error at line ${lineNumber}: expected group NAME or group NAME use TEMPLATE`,
			{ kind: 'document' },
			{ lineNumber: lineNumber - 1, instruction: 'group' }
		);
	}
	if (!isValidModuleName(name)) {
		throw syntaxErrorAt(
			SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
			`Parse error at line ${lineNumber}: invalid group name; names must match ${MODULE_NAME_PATTERN}`,
			{ kind: 'document' },
			{ lineNumber: lineNumber - 1, instruction: 'group' }
		);
	}
	if (clause === 'use') {
		if (!template || !isValidModuleName(template)) {
			throw syntaxErrorAt(
				SyntaxErrorCode.INVALID_TEMPLATE_NAME,
				syntaxErrorMessage(SyntaxErrorCode.INVALID_TEMPLATE_NAME),
				{ kind: 'document' },
				{ lineNumber: lineNumber - 1, instruction: 'group' }
			);
		}
		return { name, template };
	}
	return { name };
}

/**
 * Checks whether a project line can be skipped between project-level blocks.
 *
 * @param trimmedLine - Trimmed project line to inspect.
 * @returns True when the line is blank or a project-level comment.
 */
export function isProjectGapLine(trimmedLine: string): boolean {
	return (
		trimmedLine === '' || trimmedLine.startsWith('#') || trimmedLine.startsWith(';') || trimmedLine.startsWith('//')
	);
}
