import type { FunctionType, WasmTypeValue } from '@8f4e/compiler-wasm-utils';
import type { AssertionSite } from './assertions';
import type { ComposedFunctionAST, ComposedModuleAST, FunctionAST, ValidatedAST, ValidatedFunctionAST } from './ast';
import type { ASTCache } from './cache';
import type { FunctionImportMetadata, FunctionSignature, FunctionValueType } from './functionTypes';
import type { MemoryDefaults, MemoryLayoutPlan, MemoryPointerMetadataMap } from './memory';
import type { ProjectMemoryExposuresByGroupPath } from './project';
import type { StackAnalysisResult } from './semantic';

export type CompiledStackAnalysisLine = {
	lineNumber: number;
	instruction: string;
	stackAnalysis: StackAnalysisResult;
};

/** Code generation output and metadata for a compiled executable module. */
export interface CompiledModule {
	index: number;
	cycleFunction: number[];
	id: string;
	executionEntryName: string;
	ast: ComposedModuleAST;
	stackAnalysis?: CompiledStackAnalysisLine[];
	skipExecutionInCycle?: boolean;
}

export type CompiledModuleLookup = Record<string, CompiledModule>;

/** WebAssembly parameter and result types for a function signature. */
export interface FunctionTypeSignature {
	params: WasmTypeValue[];
	results: WasmTypeValue[];
}

/** Function type signature together with its index in the emitted type section. */
export interface RegisteredFunctionTypeSignature extends FunctionTypeSignature {
	typeIndex: number;
}

/** Registry of WebAssembly function types used while emitting a module. */
export interface FunctionTypeRegistry {
	types: FunctionType[];
	signatures: RegisteredFunctionTypeSignature[];
	baseTypeIndex: number;
}

/** Expanded parameter declarations for a source `paramShape` instruction. */
export interface FunctionParamShapeExpansion {
	lineNumber: number;
	parameters: Array<{
		name: string;
		type: FunctionValueType;
	}>;
}

/** Semantic function symbol, independent of WebAssembly layout. */
export interface FunctionMetadata {
	/** Canonical compiler identity for this concrete function. */
	id: string;
	/** Source-level callable name written by the user. */
	name: string;
	signature: FunctionSignature;
	import?: FunctionImportMetadata;
	exportName?: string;
	isImpure?: boolean;
	paramShapeExpansions?: FunctionParamShapeExpansion[];
}

export type FunctionMetadataLookup = Record<string, FunctionMetadata>;

/** Function declaration associated with the metadata produced during namespace registration. */
export interface RegisteredFunction<TFunction extends FunctionAST = ValidatedFunctionAST> {
	ast: TFunction;
	metadata: FunctionMetadata;
}

/** Final declaration and include-local call names applied during program composition. */
export interface IncludedFunctionBindings {
	functionName: string;
	callTargets: ReadonlyMap<string, string>;
}

/** Function metadata indexed by compiler id, plus source-name arity metadata for calls. */
export interface FunctionRegistry {
	byId: FunctionMetadataLookup;
	arityByName: Record<string, number>;
}

/** Code generation output and metadata for a compiled function. */
export interface CompiledFunction extends FunctionMetadata {
	wasmIndex: number;
	body: number[];
	locals: Array<{ isInteger: boolean; count: number }>;
	exportName?: string;
	used?: boolean;
	typeIndex: number;
	ast: ComposedFunctionAST;
	stackAnalysis?: CompiledStackAnalysisLine[];
}

export type CompiledFunctionLookup = Record<string, CompiledFunction>;

/** Reusable compiler caches returned from a compile operation. */
export interface CompilerCache {
	ast: ASTCache<ValidatedAST>;
}

export type CompileResult = {
	/** Native assertion sites for this compilation, present only when assertions are enabled. */
	assertionSites?: AssertionSite[];
	codeBuffer: Uint8Array;
	compiledModules: CompiledModuleLookup;
	compiledFunctions?: CompiledFunctionLookup;
	memoryPlan: MemoryLayoutPlan;
	memoryDefaultsByModuleId: Record<string, MemoryDefaults>;
	pointerMetadataByModuleId: Record<string, MemoryPointerMetadataMap>;
	projectMemoryExposuresByGroupPath: ProjectMemoryExposuresByGroupPath;
	requiredMemoryBytes: number;
	cache: CompilerCache;
};

/** Source origin for blocks expanded from built-in or external includes. */
export interface IncludedSourceMetadata {
	kind: 'include';
	includeId: string;
	symbolName: string;
}

/** Source origin metadata carried with source blocks. */
export type SourceMetadata = IncludedSourceMetadata;
