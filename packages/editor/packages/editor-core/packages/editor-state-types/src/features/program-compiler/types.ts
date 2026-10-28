/**
 * Types for program-compiler feature - WebAssembly compilation and management.
 */

import type {
	ASTCacheStats,
	CompiledFunctionLookup,
	CompiledModuleLookup,
	MemoryAction,
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

/**
 * Result of a compilation operation.
 */
export interface CompilationResult {
	codeBuffer: Uint8Array;
	memoryRef: WebAssembly.Memory;
	compiledModules: CompiledModuleLookup;
	compiledFunctions?: CompiledFunctionLookup;
	memoryPlan: MemoryLayoutPlan;
	memoryDefaultsByModuleId: Record<string, MemoryDefaults>;
	projectMemoryExposuresByGroupPath: ProjectMemoryExposuresByGroupPath;
	requiredMemoryBytes: number;
	allocatedMemoryBytes: number;
	astCacheStats: ASTCacheStats;
	memoryAction: MemoryAction;
}
