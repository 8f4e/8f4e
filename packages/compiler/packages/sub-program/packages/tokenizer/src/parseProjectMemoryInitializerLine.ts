import {
	ArgumentType,
	isValidModuleName,
	type ProjectMemoryInitializerLine,
	projectInstructions,
} from '@8f4e/language-spec';
import { parseInstructionSourceLine, withSyntaxLine } from './parseLine';
import { SyntaxErrorCode, SyntaxIssue } from './syntax/syntaxError';

/** Parses a group initializer with an exposed destination and a numeric or parent-scope address value. */
export function parseProjectMemoryInitializerLine(line: string, lineNumber: number): ProjectMemoryInitializerLine {
	const parsed = parseInstructionSourceLine(line, lineNumber);
	try {
		if (parsed.instruction !== projectInstructions.init) {
			throw new SyntaxIssue(SyntaxErrorCode.UNRECOGNISED_INSTRUCTION);
		}
		const [destination, source] = parsed.arguments;
		if (
			parsed.arguments.length !== 2 ||
			destination?.type !== ArgumentType.IDENTIFIER ||
			destination.referenceKind !== 'memory-reference' ||
			(source?.type !== ArgumentType.LITERAL &&
				(source?.type !== ArgumentType.IDENTIFIER ||
					source.referenceKind !== 'intermodular-reference' ||
					!isValidModuleName(source.targetModuleId)))
		) {
			throw new SyntaxIssue(SyntaxErrorCode.INVALID_PROJECT_MEMORY_INITIALIZER);
		}
		return {
			diagnosticSource: { kind: 'document' },
			lineNumber,
			instruction: projectInstructions.init,
			arguments: [destination, source],
		};
	} catch (error) {
		if (error instanceof SyntaxIssue) throw withSyntaxLine(error, lineNumber, parsed.instruction);
		throw error;
	}
}
