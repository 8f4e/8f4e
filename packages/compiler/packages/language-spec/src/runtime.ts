import type { AssertionSite } from './assertions';
import type { ASTCacheStats } from './cache';
import type { CompiledFunctionLookup, CompiledModuleLookup } from './compiled';
import type { MemoryDefaults, MemoryLayoutPlan } from './memory';
import type { ProjectMemoryExposuresByGroupPath } from './project';

export type MemoryReinitReason =
	| { kind: 'no-instance' }
	| { kind: 'memory-size-changed'; prevBytes: number; nextBytes: number }
	| { kind: 'memory-structure-changed' };

export type MemoryAction = { action: 'reused' } | { action: 'recreated'; reason: MemoryReinitReason };

export type GetOrCreateMemoryResult = {
	memoryRef: WebAssembly.Memory;
	memoryAction: MemoryAction;
};

export type CompileAndUpdateMemoryResult = {
	assertionSites?: AssertionSite[];
	codeBuffer: Uint8Array;
	compiledModules: CompiledModuleLookup;
	compiledFunctions?: CompiledFunctionLookup;
	memoryPlan: MemoryLayoutPlan;
	memoryDefaultsByModuleId: Record<string, MemoryDefaults>;
	projectMemoryExposuresByGroupPath: ProjectMemoryExposuresByGroupPath;
	requiredMemoryBytes: number;
	allocatedMemoryBytes: number;
	astCacheStats: ASTCacheStats;
	memoryRef: WebAssembly.Memory;
	memoryAction: MemoryAction;
};
