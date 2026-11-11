import type { DiagnosticLocation, IncludeErrorCodeValue } from '@8f4e/language-spec';
import { CompilerError } from './compilerError';

/** Constructs an include failure with a named code and a zero-based source location. */
export function includeErrorAt(
	code: IncludeErrorCodeValue,
	message: string,
	location: DiagnosticLocation
): CompilerError {
	return new CompilerError({ kind: 'source', domain: 'include', code, message, location });
}
