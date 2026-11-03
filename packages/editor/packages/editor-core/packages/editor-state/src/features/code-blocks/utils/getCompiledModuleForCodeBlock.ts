import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { CompiledModule, MemoryDefaults, PlannedMemoryModule } from '@8f4e/language-spec';
import getCodeBlockModuleId from '../../../pureHelpers/getCodeBlockModuleId';

export interface CodeBlockModuleCompilation {
	compiledModule: CompiledModule;
	plannedModule: PlannedMemoryModule;
	memoryDefaults: MemoryDefaults;
}

/** Returns module metadata only for the source block selected by the compiler. */
export function getCompiledModuleForCodeBlock(
	codeBlock: CodeBlockGraphicData,
	state: State
): CompiledModule | undefined {
	const module = state.compiler.result.compiledModules[getCodeBlockModuleId(codeBlock)];
	return module?.ast.projectBlockId === codeBlock.creationIndex ? module : undefined;
}

/** Resolves a selected source module and its complete accepted memory reports together. */
export function getModuleCompilationForCodeBlock(
	codeBlock: CodeBlockGraphicData,
	state: State
): CodeBlockModuleCompilation | undefined {
	const compiledModule = getCompiledModuleForCodeBlock(codeBlock, state);
	if (!compiledModule) return undefined;
	const plannedModule = state.compiler.result.memoryPlan.modules[compiledModule.id];
	const memoryDefaults = state.compiler.result.memoryDefaultsByModuleId[compiledModule.id];
	if (!plannedModule || !memoryDefaults) return undefined;
	return {
		compiledModule,
		plannedModule,
		memoryDefaults,
	};
}
