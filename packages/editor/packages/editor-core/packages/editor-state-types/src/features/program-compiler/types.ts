/** Compilation progress and the last accepted compiler result are published independently. */
import type { CompileResult } from '@8f4e/language-spec';

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
