/**
 * Types for program-compiler feature - WebAssembly compilation and management.
 */

import type {
	CompiledFunctionLookup,
	CompiledModuleLookup,
	MemoryDefaults,
	MemoryLayoutPlan,
	ProjectMemoryExposuresByGroupPath,
} from '@8f4e/language-spec';

/**
 * Compiler state tracking compilation progress and results.
 */
export interface Compiler {
	isCompiling: boolean;
	compiledModules: CompiledModuleLookup;
	compiledFunctions?: CompiledFunctionLookup;
	memoryPlan: MemoryLayoutPlan;
	memoryDefaultsByModuleId: Record<string, MemoryDefaults>;
	projectMemoryExposuresByGroupPath: ProjectMemoryExposuresByGroupPath;
}
