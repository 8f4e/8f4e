import { getError, includeErrorAt, syntaxErrorAt } from '@8f4e/compiler-diagnostics';
import {
	type CallLine,
	type CompilerCache,
	type ComposedAST,
	type ComposedEntry,
	createChildProjectGroupPath,
	createProjectModuleId,
	ErrorCode,
	type FunctionLine,
	type IncludedFunctionBindings,
	IncludeErrorCode,
	type ProjectConstantNamespacePassLine,
	type ProjectGroupPath,
	type ProjectMemoryExposure,
	type ProjectMemoryInitializerLine,
	type ProjectObjectModel,
	ROOT_PROJECT_GROUP_PATH,
	type ValidatedAST,
	type ValidatedConstantsAST,
	type ValidatedFunctionAST,
} from '@8f4e/language-spec';
import {
	classifyProjectScopeLine,
	parseProjectConstantNamespacePassLine,
	parseProjectMemoryInitializerLine,
	SyntaxErrorCode,
} from '@8f4e/tokenizer';
import { compileSourceToAST, createCompilerSource } from './compilerSource';
import { createCompilerCache } from './createCompilerCache';
import { qualifyAst } from './qualifyAst';
import { resolveFunctionPasses } from './resolveFunctionPasses';
import { selectModuleDefinitions } from './selectModuleDefinitions';
import type { ComposedProgram, IncludedFunctionsByProjectGroupPath } from './types';

function collectProjectScopeDeclarations(code: readonly string[], projectPath: ProjectGroupPath) {
	const passes: ProjectConstantNamespacePassLine[] = [];
	const initializers: ProjectMemoryInitializerLine[] = [];
	const diagnosticSource = { kind: 'scope', projectGroupPath: projectPath } as const;
	for (const [index, sourceLine] of code.entries()) {
		const scopeLine = classifyProjectScopeLine(sourceLine);
		if (scopeLine.kind === 'unsupported' && projectPath !== ROOT_PROJECT_GROUP_PATH)
			throw syntaxErrorAt(
				SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK,
				`Instruction "${scopeLine.instruction}" is not allowed in a group body.`,
				diagnosticSource,
				{ lineNumber: index, instruction: scopeLine.instruction }
			);
		if (scopeLine.kind !== 'declaration' || scopeLine.instruction === 'expose') continue;

		const { instruction } = scopeLine;
		const result =
			instruction === 'pass'
				? parseProjectConstantNamespacePassLine(sourceLine, index)
				: parseProjectMemoryInitializerLine(sourceLine, index);
		if (!result.ok)
			throw syntaxErrorAt(result.issue.code, result.issue.message, diagnosticSource, {
				lineNumber: index,
				instruction,
			});
		if (result.value.instruction === 'pass') passes.push({ ...result.value, diagnosticSource });
		else initializers.push({ ...result.value, diagnosticSource });
	}
	return { passes, initializers };
}

function appendMemoryExposureAliases(
	program: ComposedProgram,
	groupPath: ProjectGroupPath,
	exposures: readonly ProjectMemoryExposure[],
	groupTargets: ReadonlySet<string>
): void {
	if (exposures.length === 0) {
		return;
	}

	const aliases = new Map(program.memoryAliases);
	const groupAliases = new Map(aliases.get(groupPath));

	for (const exposure of exposures) {
		const source = {
			...exposure,
			groupPath,
			diagnosticSource: { kind: 'scope' as const, projectGroupPath: groupPath },
			instruction: 'expose' as const,
		};
		const targetModuleId = createProjectModuleId(groupPath, exposure.targetModuleName);
		const targetMemoryId = exposure.targetMemoryName;
		const target = groupTargets.has(exposure.targetModuleName)
			? aliases.get(targetModuleId)?.get(targetMemoryId)
			: { targetModuleId, targetMemoryId };
		if (!target) {
			throw getError(ErrorCode.INVALID_PROJECT_MEMORY_EXPOSURE_TARGET, source, {
				details: {
					projectGroupPath: groupPath,
					projectMemoryExposureName: exposure.name,
					targetModuleId,
					targetMemoryId,
				},
			});
		}
		program.memoryExposures.push({ ...source, ...target });
		groupAliases.set(exposure.name, target);
	}

	aliases.set(groupPath, groupAliases);
	program.memoryAliases = aliases;
}

function renameIncludedFunction(ast: ValidatedFunctionAST, bindings: IncludedFunctionBindings): ValidatedFunctionAST {
	const functionLine: FunctionLine = {
		...ast.functionLine,
		arguments: [{ ...ast.functionLine.arguments[0], value: bindings.functionName }],
	};
	return {
		...ast,
		name: bindings.functionName,
		functionLine,
		lines: ast.lines.map(line => {
			if (line === ast.functionLine) return functionLine;
			if (line.instruction !== 'call') return line;
			const target = line.arguments[0];
			const boundName = bindings.callTargets.get(target.value);
			if (boundName === null || boundName === undefined) {
				const { fileLocation } = bindings;
				const ambiguous = boundName === null;
				throw includeErrorAt(
					ambiguous ? IncludeErrorCode.AMBIGUOUS_CALL_TARGET : IncludeErrorCode.UNBOUND_CALL_TARGET,
					ambiguous
						? `include "${fileLocation.includeId}" call target "${target.value}" is ambiguous because that function name expands to multiple public/internal include names`
						: `call target "${target.value}" is not defined or imported by this include`,
					{ ...fileLocation, lineNumber: fileLocation.lineNumber + line.lineNumber }
				);
			}
			return {
				...line,
				arguments: [{ ...target, value: boundName }, ...line.arguments.slice(1)],
			} as CallLine;
		}),
	};
}

function appendUnit(
	project: ProjectObjectModel,
	projectPath: ProjectGroupPath,
	parentProjectPath: ProjectGroupPath | undefined,
	program: ComposedProgram,
	includedFunctionsByProjectPath: IncludedFunctionsByProjectGroupPath,
	exposures: readonly ProjectMemoryExposure[] = []
): Map<string, ComposedEntry> {
	const entries = new Map<string, ComposedEntry>();
	const ensureEntry = (name: string): ComposedEntry => {
		let entry = entries.get(name);
		if (!entry) {
			entry = {
				id: projectPath ? `${projectPath}/${name}` : name,
				steps: [],
				...(projectPath === ROOT_PROJECT_GROUP_PATH ? { exportName: name } : {}),
			};
			entries.set(name, entry);
			program.entries.push(entry);
		}
		return entry;
	};
	for (const name of project.entries) ensureEntry(name);
	if (projectPath === ROOT_PROJECT_GROUP_PATH) ensureEntry('main');
	const { initializers: memoryInitializers, passes: constantNamespacePasses } = collectProjectScopeDeclarations(
		project.code,
		projectPath
	);
	if (memoryInitializers.length > 0) {
		program.projectMemoryInitializerScopes.push({
			groupPath: projectPath,
			...(parentProjectPath !== undefined ? { parentGroupPath: parentProjectPath } : {}),
			initializers: memoryInitializers,
		});
	}
	if (constantNamespacePasses.length > 0) {
		program.projectConstantNamespaceScopes.push({
			groupPath: projectPath,
			...(parentProjectPath !== undefined ? { parentGroupPath: parentProjectPath } : {}),
			passes: constantNamespacePasses,
		});
	}

	const prefix = projectPath === ROOT_PROJECT_GROUP_PATH ? undefined : `${projectPath}/`;
	const qualify = <TAst extends ValidatedAST>(
		ast: TAst,
		codeBlockId = ast.type === 'function' ? ast.name : ast.id
	): ComposedAST<TAst> => {
		return {
			...(prefix ? qualifyAst(ast, prefix) : ast),
			sourceIdentity: { projectGroupPath: projectPath, codeBlockId },
		};
	};
	const constants = project.constants.filter(block => !block.disabled);
	const functions = project.functions.filter(block => !block.disabled);
	const includedFunctions = includedFunctionsByProjectPath.get(projectPath) ?? [];

	program.ast.constants.push(
		...constants.map((constantsBlock, index) =>
			qualify(
				compileSourceToAST<ValidatedConstantsAST>(
					createCompilerSource(constantsBlock, projectPath, `constants:${index}`),
					program.cache
				)
			)
		)
	);
	program.ast.functions.push(
		...includedFunctions.map((func, index) => {
			const ast = compileSourceToAST<ValidatedFunctionAST>(
				createCompilerSource(func, projectPath, `include:function:${index}`),
				program.cache
			);
			return qualify(renameIncludedFunction(ast, func.bindings), ast.name);
		}),
		...functions.map((func, index) =>
			qualify(
				compileSourceToAST<ValidatedFunctionAST>(
					createCompilerSource(func, projectPath, `function:${index}`),
					program.cache
				)
			)
		)
	);

	const selectedModules = selectModuleDefinitions(project.execution, projectPath, program.cache);
	// Only names whose last enabled declaration is a group can forward a child exposure.
	const groupTargets = new Set<string>();
	for (const block of project.execution) {
		if (block.type === 'group') {
			const groupPath = createChildProjectGroupPath(projectPath, block.name);
			const childEntries = appendUnit(
				block,
				groupPath,
				projectPath,
				program,
				includedFunctionsByProjectPath,
				block.exposures
			);
			groupTargets.add(block.name);
			const childMain = childEntries.get('main');
			if (childMain) ensureEntry(block.entry).steps.push({ type: 'entry', id: childMain.id });
			const childInit = childEntries.get('init');
			if (childInit) ensureEntry('init').steps.push({ type: 'entry', id: childInit.id });
			continue;
		}
		const moduleAst = selectedModules.get(block);
		if (!moduleAst) continue;
		groupTargets.delete(moduleAst.id);
		const entry = entries.get(block.entry)!;
		const ast = {
			...qualify(moduleAst),
			projectBlockId: block.id,
			executionEntryName: entry.id,
		};
		program.ast.modules.push(ast);
		entry.steps.push({ type: 'module', id: ast.id });
	}
	appendMemoryExposureAliases(program, projectPath, exposures, groupTargets);
	return entries;
}

/**
 * Parses and composes a recursive project tree into one globally planned compiler program.
 * Groups expand at their declaration positions; functions and constants remain hoisted.
 */
export function composeProgram(
	project: ProjectObjectModel,
	cache: CompilerCache = createCompilerCache(),
	includedFunctionsByProjectPath: IncludedFunctionsByProjectGroupPath = new Map()
): ComposedProgram {
	const program: ComposedProgram = {
		entries: [],
		ast: {
			modules: [],
			constants: [],
			functions: [],
		},
		memoryExposures: [],
		memoryAliases: new Map(),
		projectConstantNamespaceScopes: [],
		projectMemoryInitializerScopes: [],
		cache,
	};

	appendUnit(project, ROOT_PROJECT_GROUP_PATH, undefined, program, includedFunctionsByProjectPath);
	resolveFunctionPasses(program);
	return program;
}
