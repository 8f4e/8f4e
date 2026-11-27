import { parseInstructionTokens } from './parseLine';
import isComment from './syntax/isComment';
import isInstructionLikeLine from './syntax/isInstructionLikeLine';
import { SyntaxErrorCode, SyntaxIssue } from './syntax/syntaxError';

export type SourceLine = {
	line: string;
	lineNumber: number;
};

export interface PreparedSourceLines {
	lines: SourceLine[];
	instructionLineBySourceLine: Array<number | undefined>;
}

function isArgumentContinuationCandidate(line: string): boolean {
	return /^\s*-(?=\s|;|$)/.test(line);
}

function foldSourceLines(
	code: string[],
	strict: boolean,
	instructionLineBySourceLine?: Array<number | undefined>
): SourceLine[] {
	const lines: SourceLine[] = [];
	let previousSourceLine: SourceLine | undefined;
	let previousLineHasContinuations = false;

	for (let lineNumber = 0; lineNumber < code.length; lineNumber++) {
		const line = code[lineNumber];
		if (isComment(line) || !isInstructionLikeLine(line)) {
			continue;
		}

		if (!isArgumentContinuationCandidate(line)) {
			const sourceLine = { line, lineNumber };
			lines.push(sourceLine);
			if (instructionLineBySourceLine) instructionLineBySourceLine[lineNumber] = lineNumber;
			previousSourceLine = sourceLine;
			previousLineHasContinuations = false;
			continue;
		}

		let tokens: string[];
		try {
			tokens = parseInstructionTokens(line, lineNumber);
		} catch (error) {
			if (strict) throw error;
			continue;
		}

		const instruction = '-';
		if (!previousSourceLine) {
			if (strict) {
				throw new SyntaxIssue(SyntaxErrorCode.INVALID_ARGUMENT, 'Argument continuation has no instruction.', {
					lineNumber,
					instruction,
				});
			}
			continue;
		}

		if (tokens.length < 2) {
			if (strict) {
				throw new SyntaxIssue(SyntaxErrorCode.MISSING_ARGUMENT, 'Missing argument for continuation.', {
					lineNumber,
					instruction,
				});
			}
			continue;
		}

		if (!previousLineHasContinuations) {
			try {
				previousSourceLine.line = parseInstructionTokens(previousSourceLine.line, previousSourceLine.lineNumber).join(
					' '
				);
			} catch (error) {
				if (strict) throw error;
				continue;
			}
			previousLineHasContinuations = true;
		}
		previousSourceLine.line = `${previousSourceLine.line} ${tokens.slice(1).join(' ')}`;
		if (instructionLineBySourceLine) instructionLineBySourceLine[lineNumber] = previousSourceLine.lineNumber;
	}

	return lines;
}

/**
 * Prepares editor source rows and maps each continuation row to its owning instruction.
 * Invalid or incomplete continuation rows are ignored without invalidating unrelated instructions.
 *
 * @param code - Physical source lines to prepare.
 * @returns Folded logical lines and a physical-row-to-owner mapping.
 */
export function prepareSourceLines(code: string[]): PreparedSourceLines {
	const instructionLineBySourceLine = Array<number | undefined>(code.length).fill(undefined);
	return {
		lines: foldSourceLines(code, false, instructionLineBySourceLine),
		instructionLineBySourceLine,
	};
}

/**
 * Removes comments and folds argument-continuation lines, preserving compiler diagnostics for invalid syntax.
 *
 * @param code - Source lines to process.
 * @returns Logical source lines after comments and continuations are processed.
 */
export function foldArgumentContinuationLines(code: string[]): SourceLine[] {
	return foldSourceLines(code, true);
}
