import {
	type CompileProjectOptions,
	type CompileResult,
	createChildProjectGroupPath,
	getProjectGroups,
	type ProjectGroupPath,
	type ProjectObjectModel,
	ROOT_PROJECT_GROUP_PATH,
} from '@8f4e/language-spec';
import { createCompilerCache, type IncludedFunctionsByProjectGroupPath } from '@8f4e/program-composer/internal';
import { parseProjectSource, resolveProjectIncludesAsync } from '@8f4e/project-preparser';
import { deriveEffectiveMemorySize } from '@8f4e/wasm-codegen';
import { compileProjectObjectModel } from './compileProjectObjectModel';

export { serializeDiagnostic } from './diagnostic';
export { deriveEffectiveMemorySize, parseProjectSource };

/**
 * Resolves include blocks independently for every project unit in the recursive tree.
 * Reusing loaded source text does not deduplicate the resulting functions: each unit receives and compiles its own
 * qualified copies.
 */
async function resolveRecursiveProjectIncludes(
	project: ProjectObjectModel,
	resolveInclude: NonNullable<CompileProjectOptions['resolveInclude']>,
	projectPath: ProjectGroupPath = ROOT_PROJECT_GROUP_PATH,
	result: Map<ProjectGroupPath, Awaited<ReturnType<typeof resolveProjectIncludesAsync>>> = new Map()
): Promise<IncludedFunctionsByProjectGroupPath> {
	const includedFunctions = await resolveProjectIncludesAsync(project.includes, resolveInclude);
	if (includedFunctions.length > 0) {
		result.set(projectPath, includedFunctions);
	}
	await Promise.all(
		getProjectGroups(project).map(group =>
			resolveRecursiveProjectIncludes(
				group,
				resolveInclude,
				createChildProjectGroupPath(projectPath, group.name),
				result
			)
		)
	);
	return result;
}

/**
 * Memoizes include source loading across recursive project units.
 * Only the resolver's source-text promise is shared; per-unit include expansion and compilation remain independent.
 */
function createMemoizedIncludeResolver(
	resolveInclude: CompileProjectOptions['resolveInclude']
): NonNullable<CompileProjectOptions['resolveInclude']> {
	const includeSourcePromises = new Map<string, Promise<string | undefined>>();
	return includeId => {
		let source = includeSourcePromises.get(includeId);
		if (!source) {
			source = Promise.resolve(resolveInclude?.(includeId));
			includeSourcePromises.set(includeId, source);
		}
		return source;
	};
}

/** Compiles a canonical project object directly into one complete WebAssembly program. */
export async function compileProject(
	project: ProjectObjectModel,
	options: CompileProjectOptions = {}
): Promise<CompileResult> {
	const { resolveInclude, cache = createCompilerCache(), ...compilerOptions } = options;
	const memoizedResolveInclude = createMemoizedIncludeResolver(resolveInclude);
	const includedFunctionsByProjectPath = await resolveRecursiveProjectIncludes(project, memoizedResolveInclude);
	return compileProjectObjectModel(project, compilerOptions, cache, includedFunctionsByProjectPath);
}
