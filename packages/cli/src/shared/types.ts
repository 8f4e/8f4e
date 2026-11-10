import type {
	CompiledFunctionLookup,
	CompiledModuleLookup,
	CompileOptions,
	DocumentBlockType,
	MemoryDefaults,
	MemoryLayoutPlan,
	MemoryPointerMetadataMap,
	ProjectIncludeResolver,
	ProjectMemoryExposuresByGroupPath,
} from '@8f4e/language-spec';

export interface CompileProjectOptions {
	compilerOptions?: Partial<CompileOptions>;
	includeModules?: boolean;
	includeWasm?: boolean;
	includeFunctions?: boolean;
	resolveInclude?: ProjectIncludeResolver;
}

export interface CompileProjectResult {
	outputProject: Record<string, unknown>;
	compilerOptions?: CompileOptions;
	envConstants?: Readonly<Record<string, number>>;
	compiledModules: CompiledModuleLookup;
	memoryPlan: MemoryLayoutPlan;
	memoryDefaultsByModuleId: Record<string, MemoryDefaults>;
	pointerMetadataByModuleId: Record<string, MemoryPointerMetadataMap>;
	projectMemoryExposuresByGroupPath: ProjectMemoryExposuresByGroupPath;
	compiledFunctions?: CompiledFunctionLookup;
	compiledWasm: string;
	requiredMemoryBytes: number;
}

/** Compiler memory layout exported alongside a WebAssembly binary for standalone hosts. */
export interface RuntimeMemoryInfo {
	/** Effective numeric values declared in the root `constants env` block. */
	envConstants?: Readonly<Record<string, number>>;
	requiredMemoryBytes: number;
	memoryPlan: MemoryLayoutPlan;
}

export type BlockTypeValue = DocumentBlockType | 'unknown';
