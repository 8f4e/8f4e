import { syntaxErrorAt } from '@8f4e/compiler-diagnostics';
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
	type ValidatedPrototypeAST,
} from '@8f4e/language-spec';
import { parseProjectConstantNamespacePassLine, parseProjectMemoryInitializerLine } from '@8f4e/tokenizer';
import { compileSourceToAST, createCompilerSource } from './compilerSource';
import { createCompilerCache } from './createCompilerCache';
import { qualifyAst } from './qualifyAst';
import { resolveFunctionPasses } from './resolveFunctionPasses';
import { selectModuleDefinitions } from './selectModuleDefinitions';
import type { ComposedProgram, IncludedFunctionsByProjectGroupPath } from './types';

function collectProjectScopePasses(
	code: readonly string[],
	projectPath: ProjectGroupPath
): ProjectConstantNamespacePassLine[] {
	const passes: ProjectConstantNamespacePassLine[] = [];
	for (const [index, sourceLine] of code.entries()) {
		if (!/^\s*pass(?:\s|$)/.test(sourceLine)) {
			continue;
		}

		const result = parseProjectConstantNamespacePassLine(sourceLine, index);
		if (!result.ok)
			throw syntaxErrorAt(
				result.issue.code,
				result.issue.message,
				{ kind: 'scope', projectGroupPath: projectPath },
				{ lineNumber: index, instruction: 'pass' }
			);
		passes.push({ ...result.value, diagnosticSource: { kind: 'scope', projectGroupPath: projectPath } });
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
		program.memoryExposures.push({
			...exposure,
			groupPath,
			targetModuleId,
			diagnosticSource: { kind: 'scope', projectGroupPath: groupPath },
			instruction: 'expose',
		});
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
		const result = parseProjectMemoryInitializerLine(line, index);
		if (!result.ok)
			throw syntaxErrorAt(
				result.issue.code,
				result.issue.message,
				{ kind: 'scope', projectGroupPath: projectPath },
				{ lineNumber: index, instruction: 'init' }
			);
		return [{ ...result.value, diagnosticSource: { kind: 'scope' as const, projectGroupPath: projectPath } }];
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
	const constantNamespacePasses = collectProjectScopePasses(project.code, projectPath);
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
		const moduleAst = selectedModules.get(block);
		if (!moduleAst) continue;
		const entry = entries.get(block.entry)!;
		const ast = {
			...qualify(moduleAst),
			projectBlockId: block.id,
			executionEntryName: entry.id,
		};
		program.ast.modules.push(ast);
		entry.steps.push({ type: 'module', id: ast.id });
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
	resolveFunctionPasses(program);
	return program;
}
