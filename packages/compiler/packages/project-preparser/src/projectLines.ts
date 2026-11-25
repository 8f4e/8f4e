import { syntaxErrorAt } from '@8f4e/compiler-diagnostics';
import { type DiagnosticSource, isValidModuleName, MODULE_NAME_PATTERN } from '@8f4e/language-spec';
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

export interface GroupHeader {
	name: string;
	template?: string;
}

/** Parses a group opener, without changing its raw source or resolving its optional template reference. */
export function parseGroupHeader(
	line: string,
	lineNumber: number,
	diagnosticSource: DiagnosticSource = { kind: 'document' }
): GroupHeader {
	const [, name, clause, template, ...extra] = line.split(';', 1)[0].trim().split(/\s+/);
	if (!name || (clause !== undefined && clause !== 'use') || extra.length) {
		throw syntaxErrorAt(
			SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
			`Parse error at line ${lineNumber}: expected group NAME or group NAME use TEMPLATE`,
			diagnosticSource,
			{ lineNumber: lineNumber - 1, instruction: 'group' }
		);
	}
	if (!isValidModuleName(name)) {
		throw syntaxErrorAt(
			SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
			`Parse error at line ${lineNumber}: invalid group name; names must match ${MODULE_NAME_PATTERN}`,
			diagnosticSource,
			{ lineNumber: lineNumber - 1, instruction: 'group' }
		);
	}
	if (clause === 'use') {
		if (!template || !isValidModuleName(template)) {
			throw syntaxErrorAt(
				SyntaxErrorCode.INVALID_TEMPLATE_NAME,
				syntaxErrorMessage(SyntaxErrorCode.INVALID_TEMPLATE_NAME),
				diagnosticSource,
				{ lineNumber: lineNumber - 1, instruction: 'group' }
			);
		}
		return { name, template };
	}
	return { name };
}
