import type { InfoRecord, State } from '@8f4e/editor-state-types';
import type { CompilerDiagnostic } from '@8f4e/language-spec';
import { WASM_MEMORY_PAGE_SIZE } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import { hasTestEntry } from '@8f4e/test-runner';
import debounceTrailing from '../../pureHelpers/debounceTrailing';
import convertGraphicDataToProjectStructure from '../../pureHelpers/projectSerialization/serializeCodeBlocks';
import { log } from '../logger/logger';
import { DEFAULT_RECOMPILE_DEBOUNCE_DELAY, registerRecompileDebounceDelayEditorConfigValidator } from './editorConfig';

export default function compiler(store: StateManager<State>): () => void {
	const state = store.getState();
	registerRecompileDebounceDelayEditorConfigValidator(store);
	let disposed = false;

	const scheduleRecompile = debounceTrailing(
		compileProject,
		() => state.editorConfig.recompileDebounceDelay ?? DEFAULT_RECOMPILE_DEBOUNCE_DELAY
	);

	function setCompilerInfo(partial: InfoRecord): void {
		store.set('info.compiler', {
			...(state.info.compiler ?? {}),
			...partial,
		});
	}

	async function compileProject(): Promise<void> {
		if (disposed) {
			return;
		}

		store.set('codeErrors.compilationErrors', []);
		if (!state.callbacks.compileCode) {
			return;
		}

		const compilationStart = performance.now();

		store.set('compiler.isCompiling', true);
		setCompilerInfo({ isCompiling: true });

		try {
			const project = convertGraphicDataToProjectStructure(state.codeBlockRendering.rootCodeBlocks);
			const compilerOptions = {
				startingMemoryAllocationUnitAddress: 0,
				includeStackAnalysis: true,
				enableAssertions: hasTestEntry(project),
			};
			const result = await state.callbacks.compileCode(project, compilerOptions);
			if (disposed) {
				return;
			}
			const compilationTimeMs = performance.now() - compilationStart;
			const memoryUsagePercent =
				result.allocatedMemoryBytes === 0
					? 0
					: Math.round((result.requiredMemoryBytes / result.allocatedMemoryBytes) * 100);
			const memoryReinitialized = result.memoryAction.action === 'recreated';

			store.set('compiler.compiledFunctions', result.compiledFunctions);
			store.set('compiler.compiledModules', result.compiledModules);
			store.set('compiler.projectMemoryExposuresByGroupPath', result.projectMemoryExposuresByGroupPath);
			store.set('compiler.memoryPlan', result.memoryPlan);
			store.set('compiler.memoryDefaultsByModuleId', result.memoryDefaultsByModuleId);
			store.set('compiler.isCompiling', false);
			setCompilerInfo({
				isCompiling: false,
				compilationTimeMs,
				wasmByteCodeBytes: result.byteCodeSize,
				requiredMemoryBytes: result.requiredMemoryBytes,
				allocatedMemoryBytes: result.allocatedMemoryBytes,
				allocatedPages: result.allocatedMemoryBytes / WASM_MEMORY_PAGE_SIZE,
				memoryUsagePercent,
				astCacheHits: result.astCacheStats.hits,
				astCacheMisses: result.astCacheStats.misses,
				memoryReinitialized,
			});
			store.set('codeErrors.compilationErrors', []);

			if (memoryReinitialized) {
				log(state, 'WASM Memory instance was (re)created', 'Compiler');
				log(state, 'Memory was (re)initialized', 'Compiler');
			}

			log(state, 'Compilation succeeded in ' + compilationTimeMs.toFixed(2) + 'ms', 'Compiler');
			console.log('[Compiler] Compilation succeeded with config:', compilerOptions);
		} catch (error) {
			if (disposed) {
				return;
			}

			log(state, 'Compilation failed', 'Compiler');

			store.set('compiler.isCompiling', false);
			setCompilerInfo({ isCompiling: false });
			const diagnostic = error as CompilerDiagnostic;

			store.set('codeErrors.compilationErrors', [
				{
					lineNumber: diagnostic.line.lineNumber,
					codeBlockId: diagnostic.context.projectBlockId ?? -1,
					codeBlockType: diagnostic.context.codeBlockType,
					...(diagnostic.context.projectGroupPath !== undefined
						? { projectGroupPath: diagnostic.context.projectGroupPath }
						: {}),
					message: diagnostic?.message || String(error) || 'Compilation failed',
				},
			]);
		}
	}

	store.subscribe('compilerInputRevision', scheduleRecompile);

	return () => {
		disposed = true;
		scheduleRecompile.cancel();
		store.unsubscribe('compilerInputRevision', scheduleRecompile);
	};
}
