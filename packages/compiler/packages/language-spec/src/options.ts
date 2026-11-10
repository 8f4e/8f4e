import type { CompilerCache } from './compiled';
import type { ProjectIncludeResolver } from './project';

/** Size limits for function inlining, measured in lowered Wasm operations. */
export interface FunctionInliningOptions {
	/** Maximum replacement size, including argument stores and local initialization. Omit for no limit. */
	maxExpansionOperations?: number;
	/**
	 * Maximum additional operations across all expansions in one caller.
	 * By default, only duplicating bodies counts toward the 128-operation limit.
	 */
	maxCallerGrowth?: number;
}

/** Optional settings that control optimization, layout, and emitted metadata. */
export interface CompileOptions {
	/** Emit native assertion callbacks and source sites. Default is false; disabled assertions consume operands only. */
	enableAssertions?: boolean;
	/** Inline eligible functions. Default is true. */
	enableFunctionInlining?: boolean;
	/** Remove unreachable Wasm functions and unreferenced local slots. Default is true. */
	enableWasmPruning?: boolean;
	/** Guard dynamic memory accesses. Set to false to let Wasm trap on out-of-bounds access. Default is true. */
	enableMemoryGuards?: boolean;
	/** Size limits to apply when function inlining is enabled. */
	functionInlining?: FunctionInliningOptions;
	/** Address in 4-byte allocation units where the first module allocation begins. Defaults to 1 (byte address 4). */
	startingMemoryAllocationUnitAddress?: number;
	/** Whether to include per-instruction stack analysis in compiled modules and functions. Default is false. */
	includeStackAnalysis?: boolean;
}

/** Public options for compiling a complete {@link ProjectObjectModel}. */
export interface CompileProjectOptions extends CompileOptions {
	resolveInclude?: ProjectIncludeResolver;
	cache?: CompilerCache;
}
