import {
	call,
	createCodeSection,
	createDataCountSection,
	createDataSection,
	createExportSection,
	createFunction,
	createFunctionExport,
	createFunctionImport,
	createFunctionSection,
	createFunctionType,
	createImportSection,
	createMemoryImport,
	createPassiveDataSegment,
	createTypeSection,
	createWasmVersion,
	i32const,
	memoryFill,
	memoryInit,
	WASM_HEADER,
	WASM_MEMORY_PAGE_SIZE,
	WASM_TYPE_I32,
} from '@8f4e/compiler-wasm-utils';
import type {
	AssertionSite,
	CompiledFunction,
	CompiledModule,
	CompileOptions,
	CompileResult,
	CompilerCache,
	ComposedEntry,
	FunctionTypeRegistry,
	MemoryDefaults,
	MemoryLayoutPlan,
	MemoryPointerMetadataMap,
	ProjectMemoryExposuresByGroupPath,
	WasmFunctionLayout,
} from '@8f4e/language-spec';
import { createFunctionId, DEFAULT_HOST_IMPORT_MODULE_NAME } from '@8f4e/language-spec';
import createInitialMemoryDataSegments from './initialMemoryDataSegments/createInitialMemoryDataSegments';

interface EmissionProgram {
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

/**
 * Emits a complete WebAssembly binary from compiled modules, functions, and planned memory facts.
 *
 * @param program - Linkable compiler output for one source program.
 * @param options - Compiler options relevant to WebAssembly emission.
 * @returns Compiled WebAssembly program and related metadata.
 */
export function emitWasmProgram(
	program: EmissionProgram,
	options: Pick<CompileOptions, 'disableSharedMemory'>
): CompileResult {
	const {
		functionLayout,
		assertionSites,
		entries,
		compiledModules,
		compiledFunctions,
		functionTypeRegistry,
		memoryPlan,
		memoryDefaultsByModuleId,
		pointerMetadataByModuleId,
		projectMemoryExposuresByGroupPath,
		cache,
	} = program;
	const requiredMemoryBytes = memoryPlan.moduleList.reduce(
		(maximum, module) => Math.max(maximum, module.byteAddress + module.allocatedByteLength),
		0
	);
	const initialMemoryDataSegments = createInitialMemoryDataSegments(memoryPlan, memoryDefaultsByModuleId);
	const cycleFunctions = compiledModules.map(({ cycleFunction }) => cycleFunction);
	const functionSignatures = compiledModules.map(() => 0x00);
	const definedFunctions = compiledFunctions.filter(func => !func.import);
	const uniqueUserFunctionTypes = functionTypeRegistry.types;
	const userFunctionSignatureIndices = definedFunctions.map(func => func.typeIndex);
	const skippedModules = new Set(
		compiledModules.filter(module => module.skipExecutionInCycle).map(module => module.id)
	);
	const entryDispatcherFunctions = entries.map(entry =>
		createFunction(
			[],
			entry.steps.flatMap(step =>
				step.type === 'module'
					? skippedModules.has(step.id)
						? []
						: call(functionLayout.moduleFunctionIndices[step.id])
					: call(functionLayout.functions[createFunctionId(step.id, [])].wasmIndex)
			)
		)
	);
	const memoryInitiatorFunction = [
		...(requiredMemoryBytes > 0
			? [...i32const(0), ...i32const(0), ...i32const(requiredMemoryBytes), ...memoryFill()]
			: []),
		...initialMemoryDataSegments.flatMap((segment, index) => [
			...i32const(segment.byteAddress),
			...i32const(0),
			...i32const(segment.bytes.length),
			...memoryInit(index),
		]),
	];
	const memorySizePages = Math.max(1, Math.ceil(requiredMemoryBytes / WASM_MEMORY_PAGE_SIZE));
	const memoryImport = createMemoryImport(
		DEFAULT_HOST_IMPORT_MODULE_NAME,
		'memory',
		memorySizePages,
		memorySizePages,
		!options.disableSharedMemory
	);
	const functionImports = functionLayout.imports.map(func =>
		createFunctionImport(func.moduleName, func.fieldName, func.typeIndex)
	);
	const builtInFunctionSignatures = [0x00, ...entries.map(() => 0x00)];
	const builtInFunctionBodies = [createFunction([], memoryInitiatorFunction), ...entryDispatcherFunctions];
	const builtInExports = [
		createFunctionExport('initDefaults', functionLayout.initDefaultsIndex),
		...entries.flatMap(entry =>
			entry.exportName === undefined
				? []
				: [createFunctionExport(entry.exportName, functionLayout.functions[createFunctionId(entry.id, [])].wasmIndex)]
		),
	];
	const wasmVersion = createWasmVersion(1);

	return {
		...(assertionSites ? { assertionSites } : {}),
		codeBuffer: Uint8Array.from([
			...WASM_HEADER,
			...wasmVersion,
			...createTypeSection([
				createFunctionType([], []),
				createFunctionType([WASM_TYPE_I32], [WASM_TYPE_I32]),
				createFunctionType([WASM_TYPE_I32, WASM_TYPE_I32], [WASM_TYPE_I32]),
				...uniqueUserFunctionTypes,
			]),
			...createImportSection([...functionImports, memoryImport]),
			...createFunctionSection([...builtInFunctionSignatures, ...userFunctionSignatureIndices, ...functionSignatures]),
			...createExportSection([
				...builtInExports,
				...compiledFunctions
					.filter((func): func is typeof func & { exportName: string } => !!func.exportName)
					.map(func => createFunctionExport(func.exportName, func.wasmIndex)),
			]),
			...(initialMemoryDataSegments.length > 0 ? createDataCountSection(initialMemoryDataSegments.length) : []),
			...createCodeSection([...builtInFunctionBodies, ...definedFunctions.map(func => func.body), ...cycleFunctions]),
			...(initialMemoryDataSegments.length > 0
				? createDataSection(initialMemoryDataSegments.map(segment => createPassiveDataSegment(segment.bytes)))
				: []),
		]),
		compiledModules: Object.fromEntries(compiledModules.map(module => [module.id, module])),
		compiledFunctions: Object.fromEntries(compiledFunctions.map(func => [func.id, func])),
		memoryPlan,
		memoryDefaultsByModuleId,
		pointerMetadataByModuleId,
		projectMemoryExposuresByGroupPath,
		requiredMemoryBytes,
		cache,
	};
}
