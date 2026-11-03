import type {
	CompilerCache,
	ProjectExecutableBlock,
	ProjectGroupPath,
	ProjectModuleBlock,
	ValidatedModuleAST,
} from '@8f4e/language-spec';
import { compileSourceToAST, createCompilerSource } from './compilerSource';

/** Syntax-checks enabled modules and selects the last definition of each name within one project scope. */
export function selectModuleDefinitions(
	execution: readonly ProjectExecutableBlock[],
	projectPath: ProjectGroupPath,
	cache: CompilerCache
): Map<ProjectModuleBlock, ValidatedModuleAST> {
	const moduleIndexByEntry = new Map<string, number>();
	const lastModuleByName = new Map<string, { module: ProjectModuleBlock; ast: ValidatedModuleAST }>();
	for (const module of execution) {
		if (module.type !== 'module' || module.disabled) continue;
		const index = moduleIndexByEntry.get(module.entry) ?? 0;
		moduleIndexByEntry.set(module.entry, index + 1);
		const ast = compileSourceToAST<ValidatedModuleAST>(
			createCompilerSource(module, projectPath, `entry:${module.entry}:module:${index}`),
			cache
		);
		lastModuleByName.set(ast.id, { module, ast });
	}
	return new Map([...lastModuleByName.values()].map(({ module, ast }) => [module, ast]));
}
