import type {
	CompilerCache,
	ComposedConstantsAST,
	ComposedEntry,
	ComposedFunctionAST,
	ComposedModuleAST,
	ComposedPrototypeAST,
	IncludedFunctionBindings,
	ProjectConstantNamespaceScope,
	ProjectGroupPath,
	ProjectMemoryAliasLookup,
	ProjectMemoryExposure,
	ProjectMemoryInitializerScope,
	ProjectModuleId,
	SourceMetadata,
} from '@8f4e/language-spec';

/** Function source produced by resolving a project's include blocks. */
export type CompilerDerivedSource = {
	code: string[];
	projectBlockId?: number;
	source?: SourceMetadata;
};

/** Include expansions keyed by the canonical path of the project group that owns them. */
export type IncludedFunctionsByProjectGroupPath = ReadonlyMap<
	ProjectGroupPath,
	readonly (CompilerDerivedSource & { bindings: IncludedFunctionBindings })[]
>;

/** A group memory exposure with its canonical group and backing-module identities. */
export interface ComposedProjectMemoryExposure extends ProjectMemoryExposure {
	groupPath: ProjectGroupPath;
	targetModuleId: ProjectModuleId;
}

/** One globally planned AST assembled from a recursive project tree. */
export interface ComposedProgram {
	entries: ComposedEntry[];
	ast: {
		prototypes: ComposedPrototypeAST[];
		modules: ComposedModuleAST[];
		constants: ComposedConstantsAST[];
		functions: ComposedFunctionAST[];
	};
	memoryExposures: ComposedProjectMemoryExposure[];
	memoryAliases: ProjectMemoryAliasLookup;
	projectConstantNamespaceScopes: ProjectConstantNamespaceScope[];
	projectMemoryInitializerScopes: ProjectMemoryInitializerScope[];
	cache: CompilerCache;
}
