import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';

export type CompiledFunction = NonNullable<NonNullable<State['compiler']['compiledFunctions']>[string]>;
type CompiledFunctionLookup = NonNullable<State['compiler']['compiledFunctions']>;

const compiledFunctionsByBlockIdCache = new WeakMap<CompiledFunctionLookup, Map<number, CompiledFunction>>();

export function getCompiledFunctionsByBlockId(
	compiledFunctions: State['compiler']['compiledFunctions']
): Map<number, CompiledFunction> | undefined {
	if (!compiledFunctions) {
		return undefined;
	}

	let index = compiledFunctionsByBlockIdCache.get(compiledFunctions);
	if (!index) {
		index = new Map<number, CompiledFunction>();
		for (const key in compiledFunctions) {
			if (!Object.hasOwn(compiledFunctions, key)) {
				continue;
			}
			const func = compiledFunctions[key];
			const projectBlockId = func?.ast?.projectBlockId;
			if (projectBlockId !== undefined && !index.has(projectBlockId)) {
				index.set(projectBlockId, func);
			}
		}
		compiledFunctionsByBlockIdCache.set(compiledFunctions, index);
	}

	return index;
}

export function getCompiledFunctionForCodeBlock(
	graphicData: CodeBlockGraphicData,
	state: State
): CompiledFunction | undefined {
	if (graphicData.creationIndex === undefined) {
		return undefined;
	}

	return getCompiledFunctionsByBlockId(state.compiler.compiledFunctions)?.get(graphicData.creationIndex);
}
