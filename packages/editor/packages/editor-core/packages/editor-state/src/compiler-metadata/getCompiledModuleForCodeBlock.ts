import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { CompiledModule } from '@8f4e/language-spec';
import getCodeBlockModuleId from './getCodeBlockModuleId';

/** Returns module metadata only for the source block selected by the compiler. */
export function getCompiledModuleForCodeBlock(
	codeBlock: CodeBlockGraphicData,
	state: State
): CompiledModule | undefined {
	const module = state.compiler.result.compiledModules[getCodeBlockModuleId(codeBlock)];
	return module?.ast.projectBlockId === codeBlock.creationIndex ? module : undefined;
}
