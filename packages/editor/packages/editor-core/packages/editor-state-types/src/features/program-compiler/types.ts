/** Compilation progress and the last accepted compiler result are published independently. */
import type { CompileResult } from '@8f4e/language-spec';

/** Accepted compiler memory used by generic editor views. */
export interface ProgramArtifacts {
	memoryRef: WebAssembly.Memory;
}

export interface Compiler {
	isCompiling: boolean;
	result: Pick<
		CompileResult,
		| 'compiledModules'
		| 'compiledFunctions'
		| 'memoryPlan'
		| 'memoryDefaultsByModuleId'
		| 'projectMemoryExposuresByGroupPath'
	>;
}
