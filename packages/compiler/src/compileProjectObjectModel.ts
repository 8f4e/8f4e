import type { CompileOptions, CompileResult, CompilerCache, ProjectObjectModel } from '@8f4e/language-spec';
import {
	composeProgram,
	createCompilerCache,
	type IncludedFunctionsByProjectGroupPath,
} from '@8f4e/program-composer/internal';
import { compileSubProgram } from '@8f4e/sub-program/internal';
import { emitWasmProgram } from '@8f4e/wasm-codegen';

/** Synchronous compiler stage used after asynchronous project dependencies have been resolved. */
export function compileProjectObjectModel(
	project: ProjectObjectModel,
	options: CompileOptions,
	cache: CompilerCache = createCompilerCache(),
	includedFunctionsByProjectPath: IncludedFunctionsByProjectGroupPath = new Map()
): CompileResult {
	const program = composeProgram(project, cache, includedFunctionsByProjectPath);
	return emitWasmProgram(compileSubProgram(program, options));
}
