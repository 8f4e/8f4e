import type {
	AST,
	CompiledFunction,
	CompileResult,
	CompilerASTLine,
	MemoryDefault,
	MemoryDefaultValue,
	MemoryPointerMetadata,
	PlannedMemoryDeclaration,
	PlannedMemoryModule,
	ProjectBlock,
	ProjectObjectModel,
} from '@8f4e/language-spec';
import { WASM_MEMORY_PAGE_SIZE } from '@8f4e/language-spec';
import { formatTestFailures, hasTestEntry, runTests } from '@8f4e/test-runner';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileProject, parseProjectSource, serializeDiagnostic } from '../src';
import { resolveTestInclude } from './testIncludeResolver';

export interface FixtureCompileSnapshots {
	overview: Record<string, unknown>;
	moduleMemory: Record<string, unknown>;
	moduleAst: Record<string, unknown>;
	functionOverview: Record<string, unknown>;
	functionAst: Record<string, unknown>;
}

export interface CompiledFixtureProgram {
	compileResult: CompileResult;
	source: string;
	project: ProjectObjectModel;
}

export interface InstantiatedFixtureProgram extends CompiledFixtureProgram {
	instance: WebAssembly.Instance;
	host: Record<string, WebAssembly.Memory | CallableFunction>;
}

export interface FixtureProgramCompileOptions {
	extraPrototypes?: ProjectBlock[];
	includeStackAnalysis?: boolean;
	cache?: CompileResult['cache'];
}

export interface FixtureProgramInstantiateOptions extends FixtureProgramCompileOptions {
	hostImports?: Record<string, CallableFunction>;
}

export const testRoot = path.dirname(fileURLToPath(import.meta.url));

export async function collectFixtureProgramFiles(directory = testRoot): Promise<string[]> {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	const nestedFiles = await Promise.all(
		entries.map(entry => {
			const entryPath = path.join(directory, entry.name);

			if (entry.isDirectory()) {
				return collectFixtureProgramFiles(entryPath);
			}
			if (entry.isFile() && entry.name.endsWith('.test.8f4e')) {
				return [entryPath];
			}

			return [];
		})
	);

	return nestedFiles.flat().sort();
}

export function createMemory(requiredMemoryBytes: number): WebAssembly.Memory {
	const memorySizePages = Math.max(1, Math.ceil(requiredMemoryBytes / WASM_MEMORY_PAGE_SIZE));
	return new WebAssembly.Memory({ initial: memorySizePages, maximum: memorySizePages });
}

export function getExportedFunction(
	exports: WebAssembly.Exports,
	name: string,
	relativePath = 'fixture'
): CallableFunction {
	const exported = exports[name];
	if (typeof exported !== 'function') {
		throw new Error(`${relativePath}: expected compiled WebAssembly to export function "${name}"`);
	}
	return exported;
}

export function formatCompileError(relativePath: string, error: unknown): Error {
	const diagnostic = serializeDiagnostic(error);
	const line = diagnostic.line.instruction ? ` at ${diagnostic.line.instruction}` : '';
	const context = diagnostic.context.codeBlockId ? ` in ${diagnostic.context.codeBlockId}` : '';

	return new Error(`${relativePath}: ${diagnostic.message}${context}${line}`);
}

function sortRecord<T, Result>(
	record: Record<string, T> | undefined,
	mapValue: (value: T, key: string) => Result
): Record<string, Result> {
	return Object.fromEntries(
		Object.entries(record ?? {})
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, value]) => [key, mapValue(value, key)])
	);
}

function serializeDefaultValue(value: MemoryDefaultValue): MemoryDefaultValue {
	if (value === null || typeof value !== 'object') {
		return value;
	}

	return sortRecord(value, item => item);
}

function serializeMemoryData(
	data: PlannedMemoryDeclaration,
	memoryDefault: MemoryDefault | undefined,
	pointerMetadata: MemoryPointerMetadata | undefined
): Record<string, unknown> {
	return {
		id: data.id,
		type: data.type,
		numberOfElements: data.numberOfElements,
		elementWordSize: data.elementWordSize,
		allocationUnitCount: data.allocationUnitCount,
		byteAddress: data.byteAddress,
		allocationUnitAddress: data.allocationUnitAddress,
		default: serializeDefaultValue(memoryDefault?.value ?? 0),
		...(memoryDefault?.hasExplicitDefault ? { hasExplicitDefault: true } : {}),
		...(memoryDefault?.isInherited ? { isInherited: true } : {}),
		isInteger: data.isInteger,
		...(data.isFloat64 ? { isFloat64: true } : {}),
		...(data.pointeeBaseType ? { pointeeBaseType: data.pointeeBaseType } : {}),
		...(pointerMetadata?.pointeeElementCount !== undefined
			? { pointeeElementCount: pointerMetadata.pointeeElementCount }
			: {}),
		pointerDepth: data.pointerDepth,
		isUnsigned: data.isUnsigned,
	};
}

function serializeAstLine(line: CompilerASTLine): Record<string, unknown> {
	const lineSnapshot: Record<string, unknown> = { ...line };

	delete lineSnapshot.lineNumber;
	delete lineSnapshot.ifBlock;
	delete lineSnapshot.ifEndBlock;
	delete lineSnapshot.blockBlock;
	delete lineSnapshot.blockEndBlock;

	return lineSnapshot;
}

function serializeAst(ast: AST | undefined): Record<string, unknown> | undefined {
	if (!ast) {
		return undefined;
	}

	const sharedAst = {
		type: ast.type,
		lines: ast.lines.map(serializeAstLine),
	};

	if (ast.type === 'function') {
		return {
			...sharedAst,
			name: ast.name,
		};
	}

	return {
		...sharedAst,
		id: ast.id,
	};
}

function serializeCompiledModuleOverview(
	module: CompileResult['compiledModules'][string],
	plannedModule: PlannedMemoryModule
): Record<string, unknown> {
	return {
		id: module.id,
		index: module.index,
		...(module.executionEntryName ? { executionEntryName: module.executionEntryName } : {}),
		byteAddress: plannedModule.byteAddress,
		allocationUnitAddress: plannedModule.byteAddress / 4,
		allocationUnitCount: plannedModule.allocationUnitCount,
		...(module.skipExecutionInCycle ? { skipExecutionInCycle: true } : {}),
	};
}

function serializeCompiledModuleMemory(
	result: CompileResult,
	plannedModule: PlannedMemoryModule
): Record<string, unknown> {
	const memoryDefaults = result.memoryDefaultsByModuleId[plannedModule.id]!;
	const pointerMetadata = result.pointerMetadataByModuleId[plannedModule.id]!;
	return {
		memory: sortRecord(plannedModule.memory, (data, id) =>
			serializeMemoryData(data, memoryDefaults[id], pointerMetadata[id])
		),
	};
}

function serializeCompiledFunctionOverview(func: CompiledFunction): Record<string, unknown> {
	return {
		id: func.id,
		signature: func.signature,
		...(func.import ? { import: func.import } : {}),
		...(func.exportName ? { exportName: func.exportName } : {}),
		...(func.paramShapeExpansions ? { paramShapeExpansions: func.paramShapeExpansions } : {}),
	};
}

function getFixtureCompiledFunctions(result: CompileResult): Array<[string, CompiledFunction]> {
	return Object.entries(result.compiledFunctions ?? {}).sort(([left], [right]) => left.localeCompare(right));
}

export function serializeCompileResult(result: CompileResult): FixtureCompileSnapshots {
	const fixtureFunctions = getFixtureCompiledFunctions(result);
	const moduleEntries = Object.entries(result.compiledModules).sort(([left], [right]) => left.localeCompare(right));

	const moduleOverview = Object.fromEntries(
		moduleEntries.map(([id, module]) => [id, serializeCompiledModuleOverview(module, result.memoryPlan.modules[id]!)])
	);
	const moduleMemory = Object.fromEntries(
		moduleEntries.map(([id]) => [id, serializeCompiledModuleMemory(result, result.memoryPlan.modules[id]!)])
	);
	const moduleAst = Object.fromEntries(moduleEntries.map(([id, module]) => [id, serializeAst(module.ast)]));
	const functionOverview = Object.fromEntries(
		fixtureFunctions.map(([id, func]) => [id, serializeCompiledFunctionOverview(func)])
	);
	const functionAst = Object.fromEntries(fixtureFunctions.map(([id, func]) => [id, serializeAst(func.ast)]));

	return {
		overview: {
			requiredMemoryBytes: result.requiredMemoryBytes,
			compiledModules: Object.keys(moduleOverview),
			compiledFunctions: Object.keys(functionOverview),
		},
		moduleMemory,
		moduleAst,
		functionOverview,
		functionAst,
	};
}

export function getCompileSnapshotPath(filePath: string): string {
	const relativePath = path.relative(testRoot, filePath);

	return path.join(testRoot, '__snapshots__', `${relativePath}.compile-result.snap`);
}

export async function compileFixtureProgramSource(
	source: string,
	options: FixtureProgramCompileOptions = {}
): Promise<CompiledFixtureProgram> {
	const normalizedSource = source.trimStart();
	const project = parseProjectSource(normalizedSource);
	const compileProjectModel: ProjectObjectModel = {
		...project,
		prototypes: [...project.prototypes, ...(options.extraPrototypes ?? [])],
	};

	return {
		source: normalizedSource,
		project,
		compileResult: await compileProject(compileProjectModel, {
			disableSharedMemory: true,
			includeStackAnalysis: options.includeStackAnalysis,
			resolveInclude: resolveTestInclude,
			cache: options.cache,
		}),
	};
}

export async function instantiateFixtureProgramSource(
	source: string,
	options: FixtureProgramInstantiateOptions = {}
): Promise<InstantiatedFixtureProgram> {
	const compiledFixture = await compileFixtureProgramSource(source, options);
	const host = {
		memory: createMemory(compiledFixture.compileResult.requiredMemoryBytes),
		...options.hostImports,
	};
	const { instance } = await WebAssembly.instantiate(new Uint8Array(compiledFixture.compileResult.codeBuffer), {
		host,
	});

	return {
		...compiledFixture,
		host,
		instance,
	};
}

export async function runFixtureProgramFile(filePath: string) {
	const relativePath = path.relative(testRoot, filePath);
	const source = await fs.readFile(filePath, 'utf8');
	const project = parseProjectSource(source);

	if (!hasTestEntry(project)) {
		throw new Error(`${relativePath}: expected an entry test block or exported function test`);
	}

	let compiled: CompileResult;
	let result: Awaited<ReturnType<typeof runTests>>;
	try {
		compiled = await compileProject(project, {
			enableAssertions: true,
			disableSharedMemory: true,
			resolveInclude: resolveTestInclude,
		});
		result = await runTests(compiled);
	} catch (error) {
		throw formatCompileError(relativePath, error);
	}
	if (result.failures.length > 0) {
		throw new Error(`${relativePath}: ${formatTestFailures(result.failures)}`);
	}
	const compileSnapshots = serializeCompileResult(compiled);
	compileSnapshots.overview.wasmExports = Object.keys(result.instance.exports).sort();

	return { assertions: result.assertions, compileSnapshots };
}
