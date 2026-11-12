/** Compilation progress and the last accepted compiler result are published independently. */
import type { CompileResult } from '@8f4e/language-spec';

/** Accepted compiler memory used by generic editor views. */
export interface ProgramArtifacts {
	memoryRef: WebAssembly.Memory;
}

export interface Compiler {
	isCompiling: boolean;
	/** Input revision that produced the accepted result; null before the first successful compilation. */
	resultInputRevision: number | null;
	/** Source snapshots for accepted module/function line metadata, keyed by project block identity. */
	resultSourceCodeByBlockId: Readonly<Record<number, readonly string[]>>;
	result: Pick<
		CompileResult,
		| 'compiledModules'
		| 'compiledFunctions'
		| 'memoryPlan'
		| 'memoryDefaultsByModuleId'
		| 'projectMemoryExposuresByGroupPath'
	>;
}
