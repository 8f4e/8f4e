import type { CompilerDiagnostic, DiagnosticLocation, SourceDiagnostic } from '@8f4e/language-spec';

/** The exception carrier for complete source diagnostics and explicit internal failures. */
export class CompilerError<TDiagnostic extends CompilerDiagnostic = SourceDiagnostic> extends Error {
	readonly diagnostic: TDiagnostic;

	constructor(diagnostic: TDiagnostic, options?: ErrorOptions) {
		super(diagnostic.message, options);
		this.name = 'CompilerError';
		this.diagnostic = structuredClone(diagnostic);
	}
}

/** Attribute unexpected failures to their compiler phase while preserving expected source diagnostics. */
export function withCompilerStage<T>(stage: string, operation: () => T, location?: DiagnosticLocation): T {
	try {
		return operation();
	} catch (error) {
		if (error instanceof CompilerError) throw error;
		throw new CompilerError(serializeDiagnostic(error, stage, location), { cause: error });
	}
}

/** Async counterpart for include resolution and other host operations. */
export async function withAsyncCompilerStage<T>(
	stage: string,
	operation: () => Promise<T>,
	location?: DiagnosticLocation
): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		if (error instanceof CompilerError) throw error;
		throw new CompilerError(serializeDiagnostic(error, stage, location), { cause: error });
	}
}

/** Serialization preserves complete diagnostics and labels unexpected exceptions explicitly. */
export function serializeDiagnostic(error: unknown, stage: string, location?: DiagnosticLocation): CompilerDiagnostic {
	if (error instanceof CompilerError) return structuredClone(error.diagnostic);
	return {
		kind: 'internal',
		message: error instanceof Error ? error.message : String(error),
		stage,
		...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
		...(location ? { location: structuredClone(location) } : {}),
	};
}
