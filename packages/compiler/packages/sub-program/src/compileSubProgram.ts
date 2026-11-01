import { ConstantResolverError, type ResolveConstantsSubProgramAST, resolveConstants } from '@8f4e/constant-resolver';
import type {
	AssertionSite,
	CompiledFunction,
	CompiledModule,
	CompileOptions,
	CompilerCache,
	ComposedEntry,
	ComposedPrototypeAST,
	FunctionMetadata,
	FunctionMetadataLookup,
	FunctionRegistry,
	FunctionTypeRegistry,
	MemoryDefaults,
	MemoryLayoutPlan,
	MemoryPointerMetadataMap,
	ProjectMemoryExposuresByGroupPath,
	ValidatedAST,
	WasmFunctionLayout,
} from '@8f4e/language-spec';
import {
	ALLOCATION_UNIT_BYTE_SIZE,
	createFunctionId,
	ErrorCode,
	getError,
	getProjectMemoryExposureTargetError,
} from '@8f4e/language-spec';
import { MemoryDefaultResolverError, resolveMemoryDefaults } from '@8f4e/memory-default-resolver';
import { MemoryPlannerError, planSubProgramMemoryLayout } from '@8f4e/memory-planner';
import { resolveMemoryReferences } from '@8f4e/memory-reference-resolver';
import type { ComposedProgram } from '@8f4e/program-composer/internal';
import { resolveSemanticReferences } from '@8f4e/semantic-reference-resolver';
import { analyzeStack } from '@8f4e/stack-analyzer';
import { compileFunction, compileModules, planFunctionLayout } from '@8f4e/wasm-codegen';
import { planAssertions } from './assertions';
import { assertUniqueModuleIds, registerFunctions } from './semantic/buildNamespace';

interface CompiledSubProgram {
	functionLayout: WasmFunctionLayout;
	assertionSites?: AssertionSite[];
	entries: ComposedEntry[];
	compiledModules: CompiledModule[];
	compiledFunctions: CompiledFunction[];
	functionTypeRegistry: FunctionTypeRegistry;
	memoryPlan: MemoryLayoutPlan;
	memoryDefaultsByModuleId: Record<string, MemoryDefaults>;
	pointerMetadataByModuleId: Record<string, MemoryPointerMetadataMap>;
	projectMemoryExposuresByGroupPath: ProjectMemoryExposuresByGroupPath;
	cache: CompilerCache;
}

const DEFAULT_STARTING_MEMORY_ALLOCATION_UNIT_ADDRESS = 1;

/** Built-in WebAssembly export names that user functions are not allowed to reuse. */
const RESERVED_EXPORT_NAMES = ['initDefaults'];

function resolveProjectMemoryExposures(
	program: ComposedProgram,
	memoryPlan: MemoryLayoutPlan
): ProjectMemoryExposuresByGroupPath {
	const result: ProjectMemoryExposuresByGroupPath = {};
	for (const exposure of program.memoryExposures) {
		const targetMemory = memoryPlan.modules[exposure.targetModuleId]?.memory[exposure.targetMemoryName];
		if (!targetMemory) {
			throw getProjectMemoryExposureTargetError(
				exposure.groupPath,
				exposure.name,
				exposure.targetModuleId,
				exposure.targetMemoryName
			);
		}
		(result[exposure.groupPath] ??= []).push({
			...exposure,
			targetMemory,
		});
	}
	return result;
}

/** Creates synthetic metadata for generated entry dispatcher functions. */
function createEntryFunctionMetadata(entryNames: readonly string[]): FunctionRegistry {
	const byId: FunctionMetadataLookup = {};
	const arityByName: FunctionRegistry['arityByName'] = Object.create(null);

	entryNames.forEach(entryName => {
		const parameters: FunctionMetadata['signature']['parameters'] = [];
		const metadata: FunctionMetadata = {
			id: createFunctionId(entryName, parameters),
			name: entryName,
			signature: { parameters, returns: [] },
		};
		byId[metadata.id] = metadata;
		arityByName[entryName] = parameters.length;
	});

	return { byId, arityByName };
}

/** Merges function registries while preserving source-name arity metadata. */
function mergeFunctionRegistries(...registries: FunctionRegistry[]): FunctionRegistry {
	const byId: FunctionMetadataLookup = {};
	const arityByName: FunctionRegistry['arityByName'] = Object.create(null);

	for (const registry of registries) {
		Object.assign(byId, registry.byId);
		Object.assign(arityByName, registry.arityByName);
	}

	return { byId, arityByName };
}

function indexPrototypeShapes(prototypes: readonly ComposedPrototypeAST[]): Record<string, ComposedPrototypeAST> {
	return Object.fromEntries(prototypes.map(prototype => [prototype.id, prototype]));
}

function getAstDiagnosticId(ast: ValidatedAST): string | undefined {
	if (ast.type === 'function') {
		return ast.name;
	}

	return ast.id;
}

function getAstDiagnosticContext(ast: ValidatedAST) {
	return {
		codeBlockId: getAstDiagnosticId(ast),
		codeBlockType: ast.type,
		...(ast.projectBlockId !== undefined ? { projectBlockId: ast.projectBlockId } : {}),
		...(ast.source !== undefined ? { source: ast.source } : {}),
	};
}

function findAstContainingLine(
	subProgramAst: ResolveConstantsSubProgramAST,
	line: ValidatedAST['lines'][number]
): ValidatedAST | undefined {
	const groups = [subProgramAst.prototypes, subProgramAst.modules, subProgramAst.constants, subProgramAst.functions];
	for (const asts of groups) {
		const ast = asts.find(candidate => candidate.lines.includes(line));
		if (ast) {
			return ast;
		}
	}

	return undefined;
}

function wrapConstantResolverError(
	error: unknown,
	program: ComposedProgram,
	subProgramAst: ResolveConstantsSubProgramAST
): unknown {
	if (!(error instanceof ConstantResolverError)) {
		return error;
	}

	const line = error.line;
	if (!line) {
		return error;
	}

	const ast = line.instruction === 'pass' ? undefined : findAstContainingLine(subProgramAst, line);
	const projectConstantNamespaceScope = program.projectConstantNamespaceScopes.find(scope =>
		scope.passes.some(scopeLine => scopeLine === line)
	);
	const context = ast
		? getAstDiagnosticContext(ast)
		: projectConstantNamespaceScope
			? { projectGroupPath: projectConstantNamespaceScope.groupPath }
			: undefined;
	return getError(ErrorCode.CONSTANT_RESOLUTION_FAILED, line, context, {
		reason: `${error.detail} (${error.code})`,
	});
}

function wrapMemoryDefaultResolverError(error: unknown, subProgramAst: ResolveConstantsSubProgramAST): unknown {
	if (!(error instanceof MemoryDefaultResolverError)) {
		return error;
	}

	const ast = findAstContainingLine(subProgramAst, error.line);
	return getError(error.compilerErrorCode, error.line, ast ? getAstDiagnosticContext(ast) : undefined, error.details);
}

function wrapMemoryPlannerError(error: unknown, subProgramAst: ResolveConstantsSubProgramAST): unknown {
	if (!(error instanceof MemoryPlannerError)) {
		return error;
	}

	const ast = findAstContainingLine(subProgramAst, error.line);
	return getError(error.compilerErrorCode, error.line, ast ? getAstDiagnosticContext(ast) : undefined, error.details);
}

/**
 * Compiles one composed program into emission-ready module, function, memory, and data-segment artifacts.
 *
 * @param program - Parsed and recursively composed program to compile.
 * @param options - Compiler options for this compilation pass.
 * @returns The compiled sub-program artifacts.
 */
export function compileSubProgram(program: ComposedProgram, options: CompileOptions): CompiledSubProgram {
	const { ast: subProgramAst, entries, moduleEntryNames, cache } = program;
	const entryNames = entries.map(entry => entry.id);
	assertUniqueModuleIds(subProgramAst.modules);
	let constantResolution: ReturnType<typeof resolveConstants>;
	try {
		constantResolution = resolveConstants({
			ast: subProgramAst,
			projectConstantNamespaceScopes: program.projectConstantNamespaceScopes,
		});
	} catch (error) {
		throw wrapConstantResolverError(error, program, subProgramAst);
	}

	let memoryPlan: ReturnType<typeof planSubProgramMemoryLayout>;
	try {
		memoryPlan = planSubProgramMemoryLayout({
			prototypes: subProgramAst.prototypes,
			modules: subProgramAst.modules,
			constantReferences: constantResolution.references,
			startingByteAddress:
				(options.startingMemoryAllocationUnitAddress ?? DEFAULT_STARTING_MEMORY_ALLOCATION_UNIT_ADDRESS) *
				ALLOCATION_UNIT_BYTE_SIZE,
		});
	} catch (error) {
		throw wrapMemoryPlannerError(error, subProgramAst);
	}
	const projectMemoryExposuresByGroupPath = resolveProjectMemoryExposures(program, memoryPlan);
	const memoryReferenceResolution = resolveMemoryReferences({
		ast: subProgramAst,
		memoryPlan,
		memoryAliases: program.memoryAliases,
		projectMemoryInitializerScopes: program.projectMemoryInitializerScopes,
		constantReferences: constantResolution.references,
	});
	const { pointerMetadataByModuleId } = memoryReferenceResolution.references;
	const prototypeShapesById = indexPrototypeShapes(subProgramAst.prototypes);
	let memoryDefaultsByModuleId: ReturnType<typeof resolveMemoryDefaults>;
	try {
		memoryDefaultsByModuleId = resolveMemoryDefaults({
			memoryPlan,
			memoryReferences: memoryReferenceResolution.references,
		});
	} catch (error) {
		throw wrapMemoryDefaultResolverError(error, subProgramAst);
	}

	const entryFunctionMetadata = createEntryFunctionMetadata(entryNames);
	const registration = registerFunctions(subProgramAst.functions, {
		reservedFunctionIds: entryNames,
		reservedExportNames: [
			...RESERVED_EXPORT_NAMES,
			...entries.flatMap(entry => (entry.exportName === undefined ? [] : [entry.exportName])),
		],
		prototypeShapes: prototypeShapesById,
	});
	const functionRegistry = mergeFunctionRegistries(entryFunctionMetadata, registration.registry);

	const functionTypeRegistry: FunctionTypeRegistry = {
		types: [],
		signatures: [],
		baseTypeIndex: 3,
	};
	const semanticReferences = resolveSemanticReferences({
		ast: subProgramAst,
		registeredFunctions: registration.declarations,
		memoryPlan,
		memoryAliases: program.memoryAliases,
		pointerMetadataByModuleId,
		constantReferences: constantResolution.references,
		memoryReferences: memoryReferenceResolution.references,
		functions: functionRegistry,
		functionTypeRegistry,
		prototypeShapes: prototypeShapesById,
	}).references;
	const stackReport = analyzeStack({
		semanticReferences,
		memoryPlan,
		pointerMetadataByModuleId,
		functions: functionRegistry,
		functionTypeRegistry,
	});

	const assertionPlan = options.enableAssertions ? planAssertions(semanticReferences, stackReport) : undefined;
	const functionLayout = planFunctionLayout(
		semanticReferences,
		entryNames,
		assertionPlan?.imports ?? [],
		functionTypeRegistry
	);

	const compiledFunctions = Object.values(semanticReferences.functions).map(resolved =>
		compileFunction(
			resolved,
			functionTypeRegistry,
			functionLayout,
			stackReport.functions[resolved.metadata.id],
			options,
			assertionPlan?.calls.get(resolved.ast)
		)
	);
	const compiledModules = compileModules(
		Object.values(semanticReferences.modules),
		options,
		stackReport,
		functionLayout,
		functionTypeRegistry,
		assertionPlan?.calls
	).map((module, index) => ({
		...module,
		executionEntryName: moduleEntryNames[index],
	}));

	return {
		functionLayout,
		...(assertionPlan ? { assertionSites: assertionPlan.sites } : {}),
		entries,
		compiledModules,
		compiledFunctions,
		functionTypeRegistry,
		memoryPlan,
		memoryDefaultsByModuleId,
		pointerMetadataByModuleId,
		projectMemoryExposuresByGroupPath,
		cache,
	};
}
