import type { Argument, CompilerASTLine } from '@8f4e/language-spec';
import { parseArgument } from './syntax/parseArgument';
import { SyntaxErrorCode, SyntaxIssue } from './syntax/syntaxError';
import validateInstructionArguments from './syntax/validateInstructionArguments';

/**
 * Tokenizes an instruction line, treating quoted strings as single tokens.
 * Stops at an unquoted semicolon (comment delimiter).
 * Escape sequences inside quotes are preserved for parseArgument to decode.
 */
function tokenizeInstruction(line: string): string[] {
	const tokens: string[] = [];
	let i = 0;
	const len = line.length;

	while (i < len) {
		if (/\s/.test(line[i])) {
			i++;
			continue;
		}

		if (line[i] === ';') break;

		if (line[i] === '"') {
			let token = '"';
			i++;
			while (i < len && line[i] !== '"') {
				if (line[i] === '\\' && i + 1 < len) {
					token += line[i] + line[i + 1];
					i += 2;
				} else {
					token += line[i++];
				}
			}
			if (i >= len) {
				throw new SyntaxIssue(SyntaxErrorCode.INVALID_STRING_LITERAL, 'Unterminated string literal');
			}
			token += '"';
			i++;
			tokens.push(token);
		} else {
			let token = '';
			while (i < len && !/\s/.test(line[i]) && line[i] !== ';') {
				token += line[i++];
			}
			if (token) tokens.push(token);
		}
	}

	return tokens;
}

/** Recreates a syntax error with source line metadata from the parser context. */
export function withSyntaxLine(error: SyntaxIssue, lineNumber: number, instruction?: string): SyntaxIssue {
	return new SyntaxIssue(error.code, error.message, {
		lineNumber,
		instruction,
	});
}

export interface ParsedInstructionSourceLine {
	instruction: string;
	arguments: Argument[];
}

/** Parses instruction tokens and arguments without classifying the instruction's source domain. */
export function parseInstructionSourceLine(line: string, lineNumber: number): ParsedInstructionSourceLine {
	let instruction: string | undefined;
	try {
		const tokens = tokenizeInstruction(line);
		const [first = '', ...args] = tokens;
		instruction = first;
		return {
			instruction,
			arguments: args.map(parseArgument),
		};
	} catch (error) {
		if (error instanceof SyntaxIssue) {
			throw withSyntaxLine(error, lineNumber, instruction);
		}
		throw error;
	}
}

/**
 * Tokenizes a physical line and attaches line metadata to tokenizer-level syntax errors.
 *
 * @param line - Source AST line being processed.
 * @param lineNumber - One-based source line number for diagnostics.
 * @returns Instruction tokens parsed from the physical source line.
 */
export function parseInstructionTokens(line: string, lineNumber: number): string[] {
	try {
		return tokenizeInstruction(line);
	} catch (error) {
		if (error instanceof SyntaxIssue) {
			throw withSyntaxLine(error, lineNumber);
		}
		throw error;
	}
}

/**
 * Parses and syntax-validates one logical source line into an AST line.
 *
 * @param line - Source AST line being processed.
 * @param lineNumber - One-based source line number for diagnostics.
 * @returns Parsed compiler AST line.
 */
export function parseLine(line: string, lineNumber: number): CompilerASTLine {
	const parsed = parseInstructionSourceLine(line, lineNumber);
	try {
		validateInstructionArguments(parsed.instruction, parsed.arguments);
		const parsedLine = {
			lineNumber,
			diagnosticSource: { kind: 'document' } as const,
			...parsed,
		} as CompilerASTLine;

		return parsedLine;
	} catch (error) {
		if (error instanceof SyntaxIssue) {
			throw withSyntaxLine(error, lineNumber, parsed.instruction);
		}
		throw error;
	}
}
