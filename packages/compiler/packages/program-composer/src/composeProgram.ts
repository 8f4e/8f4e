import {
	type CallLine,
	type CompilerCache,
	type ComposedAST,
	type ComposedEntry,
	createChildProjectGroupPath,
	createProjectModuleId,
	type FunctionLine,
	type IncludedFunctionBindings,
	type ProjectConstantNamespacePassLine,
	type ProjectGroupPath,
	type ProjectMemoryExposure,
	type ProjectMemoryInitializerLine,
	type ProjectObjectModel,
	ROOT_PROJECT_GROUP_PATH,
	type ValidatedAST,
	type ValidatedConstantsAST,
	type ValidatedFunctionAST,
	type ValidatedModuleAST,
	type ValidatedPrototypeAST,
} from '@8f4e/language-spec';
import {
	parseProjectConstantNamespacePassLine,
	parseProjectMemoryInitializerLine,
	SyntaxRulesError,
} from '@8f4e/tokenizer';
import { compileSourceToAST, createCompilerSource } from './compilerSource';
import { createCompilerCache } from './createCompilerCache';
import { qualifyAst } from './qualifyAst';
import type { ComposedProgram, IncludedFunctionsByProjectGroupPath } from './types';

function collectProjectConstantNamespacePasses(
	code: readonly string[],
	projectPath: ProjectGroupPath
): ProjectConstantNamespacePassLine[] {
	const passes: ProjectConstantNamespacePassLine[] = [];
	for (const [index, sourceLine] of code.entries()) {
		if (!/^\s*pass(?:\s|$)/.test(sourceLine)) {
			continue;
		}

		try {
			passes.push(parseProjectConstantNamespacePassLine(sourceLine, index));
		} catch (error) {
			if (error instanceof SyntaxRulesError) {
				error.context = { ...error.context, projectGroupPath: projectPath };
			}
			throw error;
		}
	}
	return passes;
}

function appendMemoryExposureAliases(
	program: ComposedProgram,
	groupPath: ProjectGroupPath,
	exposures: ProjectMemoryExposure[]
): void {
	if (exposures.length === 0) {
		return;
	}

	const aliases = new Map(program.memoryAliases);
	const groupAliases = new Map(aliases.get(groupPath));

	for (const exposure of exposures) {
		const targetModuleId = createProjectModuleId(groupPath, exposure.targetModuleName);
		program.memoryExposures.push({ ...exposure, groupPath, targetModuleId });
		groupAliases.set(exposure.name, { targetModuleId, targetMemoryId: exposure.targetMemoryName });
	}

	aliases.set(groupPath, groupAliases);
	program.memoryAliases = aliases;
}

function collectProjectMemoryInitializers(
	code: readonly string[],
	projectPath: ProjectGroupPath
): ProjectMemoryInitializerLine[] {
	return code.flatMap((line, index) => {
		if (!/^\s*init(?:\s|$)/.test(line)) return [];
		try {
			return [parseProjectMemoryInitializerLine(line, index)];
		} catch (error) {
			if (error instanceof SyntaxRulesError) error.context = { ...error.context, projectGroupPath: projectPath };
			throw error;
		}
	});
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
			return {
				...line,
				arguments: [
					{ ...target, value: bindings.callTargets.get(target.value) ?? target.value },
					...line.arguments.slice(1),
				],
			} as CallLine;
		}),
	};
}

function appendUnit(
	project: ProjectObjectModel,
	projectPath: ProjectGroupPath,
	parentProjectPath: ProjectGroupPath | undefined,
	program: ComposedProgram,
	includedFunctionsByProjectPath: IncludedFunctionsByProjectGroupPath
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
	const memoryInitializers = collectProjectMemoryInitializers(project.code, projectPath);
	if (memoryInitializers.length > 0) {
		program.projectMemoryInitializerScopes.push({
			groupPath: projectPath,
			...(parentProjectPath !== undefined ? { parentGroupPath: parentProjectPath } : {}),
			initializers: memoryInitializers,
		});
	}
	const constantNamespacePasses = collectProjectConstantNamespacePasses(project.code, projectPath);
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
	const prototypes = project.prototypes.filter(block => !block.disabled);
	const constants = project.constants.filter(block => !block.disabled);
	const functions = project.functions.filter(block => !block.disabled);
	const includedFunctions = includedFunctionsByProjectPath.get(projectPath) ?? [];

	program.ast.prototypes.push(
		...prototypes.map((prototype, index) =>
			qualify(
				compileSourceToAST<ValidatedPrototypeAST>(
					createCompilerSource(prototype, projectPath, `prototype:${index}`),
					program.cache
				)
			)
		)
	);
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
		...functions.map((func, index) =>
			qualify(
				compileSourceToAST<ValidatedFunctionAST>(
					createCompilerSource(func, projectPath, `function:${index}`),
					program.cache
				)
			)
		),
		...includedFunctions.map((func, index) => {
			const ast = compileSourceToAST<ValidatedFunctionAST>(
				createCompilerSource(func, projectPath, `include:function:${index}`),
				program.cache
			);
			return qualify(renameIncludedFunction(ast, func.bindings), ast.name);
		})
	);

	const moduleIndexByEntry = new Map<string, number>();
	for (const block of project.execution) {
		if (block.type === 'group') {
			const groupPath = createChildProjectGroupPath(projectPath, block.name);
			appendMemoryExposureAliases(program, groupPath, block.exposures);
			const childEntries = appendUnit(block, groupPath, projectPath, program, includedFunctionsByProjectPath);
			const childMain = childEntries.get('main');
			if (childMain) ensureEntry(block.entry).steps.push({ type: 'entry', id: childMain.id });
			const childInit = childEntries.get('init');
			if (childInit) ensureEntry('init').steps.push({ type: 'entry', id: childInit.id });
			continue;
		}
		const module = block;
		if (module.disabled) continue;
		const index = moduleIndexByEntry.get(module.entry) ?? 0;
		moduleIndexByEntry.set(module.entry, index + 1);
		const ast = qualify(
			compileSourceToAST<ValidatedModuleAST>(
				createCompilerSource(module, projectPath, `entry:${module.entry}:module:${index}`),
				program.cache
			)
		);
		program.ast.modules.push(ast);
		const entry = entries.get(module.entry)!;
		entry.steps.push({ type: 'module', id: ast.id });
		program.moduleEntryNames.push(entry.id);
	}
	return entries;
}

/**
 * Parses and composes a recursive project tree into one globally planned compiler program.
 * Groups expand at their declaration positions; functions, constants, and prototypes remain hoisted.
 */
export function composeProgram(
	project: ProjectObjectModel,
	cache: CompilerCache = createCompilerCache(),
	includedFunctionsByProjectPath: IncludedFunctionsByProjectGroupPath = new Map()
): ComposedProgram {
	const program: ComposedProgram = {
		entries: [],
		moduleEntryNames: [],
		ast: {
			prototypes: [],
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
	return program;
}
