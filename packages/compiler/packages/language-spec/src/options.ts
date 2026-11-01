import type { CompilerCache } from './compiled';
import type { ProjectIncludeResolver } from './project';

/** Optional settings that control compiler layout and emitted metadata. */
export interface CompileOptions {
	/** Emit native assertion callbacks and source sites. Default is false; disabled assertions consume operands only. */
	enableAssertions?: boolean;
	/** Address in 4-byte allocation units where the first module allocation begins. Defaults to 1 (byte address 4). */
	startingMemoryAllocationUnitAddress?: number;
	/** Whether to include per-instruction stack analysis in compiled modules and functions. Default is false. */
	includeStackAnalysis?: boolean;
	/** Disable shared memory for tests (wabt doesn't support shared memory). Default is false (shared enabled). */
	disableSharedMemory?: boolean;
}

/** Public options for compiling a complete {@link ProjectObjectModel}. */
export interface CompileProjectOptions extends CompileOptions {
	resolveInclude?: ProjectIncludeResolver;
	cache?: CompilerCache;
}
