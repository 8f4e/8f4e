import { compileProject, deriveEffectiveMemorySize } from '@8f4e/compiler';
import type {
	CompileAndUpdateMemoryResult,
	CompileOptions,
	CompilerCache,
	MemoryDefaults,
	MemoryLayoutPlan,
	MemoryValueChange,
	ProjectIncludeResolver,
	ProjectObjectModel,
} from '@8f4e/language-spec';
import { ALLOCATION_UNIT_BYTE_SIZE, IGNORED_ASSERTION_IMPORTS } from '@8f4e/language-spec';
import getMemoryValueChanges from './getMemoryValueChanges';
import getOrCreateMemory from './getOrCreateMemory';

interface PreviousCompileState {
	compiledModules: CompileAndUpdateMemoryResult['compiledModules'];
	memoryPlan: MemoryLayoutPlan;
	memoryDefaultsByModuleId: Record<string, MemoryDefaults>;
}

let previousCompileState: PreviousCompileState | undefined;
let compilerCache: CompilerCache | undefined;

type MemoryBufferView = Int8Array | Int16Array | Int32Array | Float32Array | Float64Array;

function patchElements(view: MemoryBufferView, firstElementIndex: number, value: MemoryValueChange['value']): void {
	if (typeof value === 'object') {
		Object.entries(value).forEach(([index, item]) => {
			view[firstElementIndex + parseInt(index, 10)] = item;
		});
		return;
	}

	view[firstElementIndex] = value;
}

export default async function compileAndUpdateMemory(
	project: ProjectObjectModel,
	compilerOptions: CompileOptions,
	resolveInclude: ProjectIncludeResolver = () => undefined
): Promise<CompileAndUpdateMemoryResult> {
	const {
		assertionSites,
		codeBuffer,
		compiledModules,
		requiredMemoryBytes,
		compiledFunctions,
		memoryPlan,
		memoryDefaultsByModuleId,
		projectMemoryExposuresByGroupPath,
		cache,
	} = await compileProject(project, {
		...compilerOptions,
		cache: compilerCache,
		resolveInclude,
	});
	compilerCache = cache;
	const allocatedMemoryBytes = deriveEffectiveMemorySize(requiredMemoryBytes);
	// We must recreate when size changes (even when shrinking) because the WASM module's
	// declared maximum must match the memory's maximum exactly
	const currentCompileState = {
		compiledModules,
		memoryPlan,
		memoryDefaultsByModuleId,
	};
	const { memoryRef, memoryAction } = getOrCreateMemory(
		allocatedMemoryBytes,
		currentCompileState,
		previousCompileState
	);

	const memoryWasRecreated = memoryAction.action === 'recreated';
	const { instance } = await WebAssembly.instantiate(new Uint8Array(codeBuffer), {
		host: { memory: memoryRef, ...IGNORED_ASSERTION_IMPORTS },
	});
	const initDefaults = instance.exports.initDefaults as CallableFunction;

	// Memory needs initialization when:
	// - First compilation (!previousCompileState)
	// - Memory structure changed
	// - Memory was recreated
	const needsInitialization = !previousCompileState || memoryWasRecreated;

	if (needsInitialization) {
		initDefaults();
	} else {
		// Narrow integer arrays are packed by element width, so a declaration must be patched through a view
		// matching its element size instead of always assuming 4-byte allocation units.
		const memoryBufferInt8 = new Int8Array(memoryRef.buffer);
		const memoryBufferInt16 = new Int16Array(memoryRef.buffer);
		const memoryBufferInt = new Int32Array(memoryRef.buffer);
		const memoryBufferFloat = new Float32Array(memoryRef.buffer);
		const memoryBufferFloat64 = new Float64Array(memoryRef.buffer);
		const memoryValueChanges = getMemoryValueChanges(currentCompileState, previousCompileState);

		memoryValueChanges.forEach(change => {
			// Allocation-unit addresses are 4-byte based; converting to a byte address and dividing by the
			// element width yields the first element index inside the matching typed view.
			const firstElementIndex = (change.allocationUnitAddress * ALLOCATION_UNIT_BYTE_SIZE) / change.elementWordSize;

			if (change.isInteger && change.elementWordSize === 1) {
				patchElements(memoryBufferInt8, firstElementIndex, change.value);
			} else if (change.isInteger && change.elementWordSize === 2) {
				patchElements(memoryBufferInt16, firstElementIndex, change.value);
			} else if (change.isInteger) {
				patchElements(memoryBufferInt, firstElementIndex, change.value);
			} else if (change.elementWordSize === 8) {
				patchElements(memoryBufferFloat64, firstElementIndex, change.value);
			} else {
				patchElements(memoryBufferFloat, firstElementIndex, change.value);
			}
		});
	}

	previousCompileState = currentCompileState;

	return {
		assertionSites,
		codeBuffer,
		compiledModules,
		compiledFunctions,
		memoryPlan,
		memoryDefaultsByModuleId,
		projectMemoryExposuresByGroupPath,
		requiredMemoryBytes,
		allocatedMemoryBytes,
		astCacheStats: { ...cache.ast.stats },
		memoryRef,
		memoryAction,
	};
}
