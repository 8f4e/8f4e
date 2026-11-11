import type { CompilerDiagnosticLine, DiagnosticSource } from '@8f4e/language-spec';
import { CompilerError } from './compilerError';

/** Creates a syntax diagnostic only after a parser has identified its source position. */
export function syntaxErrorAt(
	code: number,
	message: string,
	source: DiagnosticSource,
	line: Pick<CompilerDiagnosticLine, 'lineNumber' | 'instruction'>
): CompilerError {
	return new CompilerError({
		kind: 'source',
		domain: 'syntax',
		code,
		message,
		location: { ...source, lineNumber: line.lineNumber },
		...(line.instruction !== undefined ? { instruction: line.instruction } : {}),
	});
}
