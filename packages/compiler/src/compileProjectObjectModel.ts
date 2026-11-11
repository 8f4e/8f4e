import { withCompilerStage } from '@8f4e/compiler-diagnostics';
import type { CompileOptions, CompileResult, CompilerCache, ProjectObjectModel } from '@8f4e/language-spec';
import {
	composeProgram,
	createCompilerCache,
	type IncludedFunctionsByProjectGroupPath,
} from '@8f4e/program-composer/internal';
import { compileSubProgram } from '@8f4e/sub-program/internal';

/** Synchronous compiler stage used after asynchronous project dependencies have been resolved. */
export function compileProjectObjectModel(
	project: ProjectObjectModel,
	options: CompileOptions,
	cache: CompilerCache = createCompilerCache(),
	includedFunctionsByProjectPath: IncludedFunctionsByProjectGroupPath = new Map()
): CompileResult {
	const program = withCompilerStage('program composition', () =>
		composeProgram(project, cache, includedFunctionsByProjectPath)
	);
	return compileSubProgram(program, options);
}
