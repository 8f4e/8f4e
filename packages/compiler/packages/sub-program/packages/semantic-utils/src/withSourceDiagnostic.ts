import { CompilerError, serializeDiagnostic } from '@8f4e/compiler-diagnostics';
import type { CompilerDiagnosticLine } from '@8f4e/language-spec';

/** Keeps diagnostics attached to the source instruction when its operations have been normalized. */
export function withSourceDiagnostic<T>(sourceLine: CompilerDiagnosticLine, stage: string, operation: () => T): T {
	try {
		return operation();
	} catch (error) {
		const location = { ...sourceLine.diagnosticSource, lineNumber: sourceLine.lineNumber };
		const diagnostic = serializeDiagnostic(error, stage, location);
		throw new CompilerError(
			diagnostic.kind === 'source'
				? { ...diagnostic, instruction: sourceLine.instruction }
				: { ...diagnostic, location: diagnostic.location ?? location },
			{ cause: error }
		);
	}
}
