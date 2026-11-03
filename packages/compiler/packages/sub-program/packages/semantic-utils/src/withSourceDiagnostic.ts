import type { CompilerDiagnosticLine } from '@8f4e/language-spec';

/** Keeps diagnostics attached to the source instruction when its operations have been normalized. */
export function withSourceDiagnostic<T>(sourceLine: CompilerDiagnosticLine, operation: () => T): T {
	try {
		return operation();
	} catch (error) {
		if (typeof error === 'object' && error !== null && 'code' in error && 'line' in error) {
			throw { ...error, line: sourceLine };
		}
		throw error;
	}
}
