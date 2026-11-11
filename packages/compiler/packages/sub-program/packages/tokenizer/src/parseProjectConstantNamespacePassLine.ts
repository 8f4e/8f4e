import {
	ArgumentType,
	isValidModuleName,
	MODULE_NAME_PATTERN,
	type ProjectConstantNamespacePassLine,
	projectInstructions,
} from '@8f4e/language-spec';
import { parseInstructionSourceLine, withSyntaxLine } from './parseLine';
import { SyntaxErrorCode, SyntaxIssue } from './syntax/syntaxError';

/** Parses one project-scope namespace pass declaration. */
export function parseProjectConstantNamespacePassLine(
	line: string,
	lineNumber: number
): ProjectConstantNamespacePassLine {
	const parsed = parseInstructionSourceLine(line, lineNumber);

	try {
		if (parsed.instruction !== projectInstructions.pass) {
			throw new SyntaxIssue(SyntaxErrorCode.UNRECOGNISED_INSTRUCTION);
		}
		if (parsed.arguments.length === 0) {
			throw new SyntaxIssue(SyntaxErrorCode.MISSING_ARGUMENT, 'Missing required namespace for pass.');
		}
		if (parsed.arguments.length > 1) {
			throw new SyntaxIssue(SyntaxErrorCode.INVALID_ARGUMENT, 'Too many arguments for pass.');
		}

		const [namespace] = parsed.arguments;
		if (namespace.type !== ArgumentType.IDENTIFIER || !isValidModuleName(namespace.value)) {
			throw new SyntaxIssue(
				SyntaxErrorCode.INVALID_IDENTIFIER,
				`Invalid namespace name. Namespace names must match ${MODULE_NAME_PATTERN}.`
			);
		}

		return {
			diagnosticSource: { kind: 'document' },
			lineNumber,
			instruction: projectInstructions.pass,
			arguments: [namespace],
		};
	} catch (error) {
		if (error instanceof SyntaxIssue) {
			throw withSyntaxLine(error, lineNumber, parsed.instruction);
		}
		throw error;
	}
}
