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

function compilerErrorAtStage(
	error: unknown,
	stage: string,
	location?: DiagnosticLocation
): CompilerError<CompilerDiagnostic> {
	if (
		error instanceof CompilerError &&
		(error.diagnostic.kind === 'source' || error.diagnostic.location !== undefined || location === undefined)
	)
		return error;
	return new CompilerError(serializeDiagnostic(error, stage, location), { cause: error });
}

/** Attribute unexpected failures to their compiler phase while preserving expected source diagnostics. */
export function withCompilerStage<T>(stage: string, operation: () => T, location?: DiagnosticLocation): T {
	try {
		return operation();
	} catch (error) {
		throw compilerErrorAtStage(error, stage, location);
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
		throw compilerErrorAtStage(error, stage, location);
	}
}

/** Preserves diagnostics, adding known locations only to internal failures that lack one. */
export function serializeDiagnostic(error: unknown, stage: string, location?: DiagnosticLocation): CompilerDiagnostic {
	if (error instanceof CompilerError) {
		const diagnostic: CompilerDiagnostic = structuredClone(error.diagnostic);
		if (diagnostic.kind === 'internal' && diagnostic.location === undefined && location !== undefined)
			diagnostic.location = structuredClone(location);
		return diagnostic;
	}
	return {
		kind: 'internal',
		message: error instanceof Error ? error.message : String(error),
		stage,
		...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
		...(location ? { location: structuredClone(location) } : {}),
	};
}
