import type { EditorPluginContext } from '@8f4e/editor-core';
import { logMessage, serializeCodeBlocksToProject } from '@8f4e/editor-state';
import type { InfoRecord } from '@8f4e/editor-state-types';
import type { CompilerDiagnostic } from '@8f4e/language-spec';
import { WASM_MEMORY_PAGE_SIZE } from '@8f4e/language-spec';
import { hasTestEntry } from '@8f4e/test-runner';
import type { CompilerService } from './compiler-service';
import debounceTrailing from './debounce-trailing';
import { compilerEditorConfigSchemaContribution, getRecompileDebounceDelay } from './editor-config';

export default function installCompilation(
	{ store, events }: Pick<EditorPluginContext, 'store' | 'events'>,
	compileCode: CompilerService['compileCode']
): () => void {
	const state = store.getState();
	store.set('editorConfigSchemaContributions.compiler', compilerEditorConfigSchemaContribution);
	let disposed = false;
	let inputGeneration = 0;
	let compiling = false;
	let compileQueued = false;

	const scheduleRecompile = debounceTrailing(compileProject, () => getRecompileDebounceDelay(state.editorConfig));

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
		// The worker updates shared memory and caches; never overlap its compilation requests.
		if (compiling) {
			compileQueued = true;
			return;
		}
		compiling = true;

		store.set('codeErrors.compilationErrors', []);

		const generation = inputGeneration;
		const isCurrent = () => !disposed && generation === inputGeneration;
		const compilationStart = performance.now();

		store.set('compiler.isCompiling', true);
		setCompilerInfo({ isCompiling: true });

		try {
			const project = serializeCodeBlocksToProject(state.codeBlockRendering.rootCodeBlocks);
			const compilerOptions = {
				startingMemoryAllocationUnitAddress: 0,
				includeStackAnalysis: true,
				enableAssertions: hasTestEntry(project),
			};
			const result = await compileCode(project, compilerOptions, isCurrent);
			if (!isCurrent()) {
				return;
			}
			const compilationTimeMs = performance.now() - compilationStart;
			const memoryUsagePercent =
				result.allocatedMemoryBytes === 0
					? 0
					: Math.round((result.requiredMemoryBytes / result.allocatedMemoryBytes) * 100);
			const memoryReinitialized = result.memoryAction.action === 'recreated';

			// Publish rendering artifacts before metadata subscriptions or runtimes can react.
			events.dispatch('compilationSucceeded', { memoryRef: result.memoryRef, codeBuffer: result.codeBuffer });
			store.set('compiler.compiledFunctions', result.compiledFunctions);
			store.set('compiler.compiledModules', result.compiledModules);
			store.set('compiler.projectMemoryExposuresByGroupPath', result.projectMemoryExposuresByGroupPath);
			store.set('compiler.memoryPlan', result.memoryPlan);
			store.set('compiler.memoryDefaultsByModuleId', result.memoryDefaultsByModuleId);
			store.set('compiler.isCompiling', false);
			setCompilerInfo({
				isCompiling: false,
				compilationTimeMs,
				wasmByteCodeBytes: result.codeBuffer.byteLength,
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
				logMessage(state, 'WASM Memory instance was (re)created', 'Compiler');
				logMessage(state, 'Memory was (re)initialized', 'Compiler');
			}

			logMessage(state, 'Compilation succeeded in ' + compilationTimeMs.toFixed(2) + 'ms', 'Compiler');
			console.log('[Compiler] Compilation succeeded with config:', compilerOptions);
		} catch (error) {
			if (!isCurrent()) {
				return;
			}

			logMessage(state, 'Compilation failed', 'Compiler');

			store.set('compiler.isCompiling', false);
			setCompilerInfo({ isCompiling: false });
			const diagnostic = error as CompilerDiagnostic;

			store.set('codeErrors.compilationErrors', [
				{
					lineNumber: diagnostic?.line?.lineNumber ?? 0,
					codeBlockId: diagnostic?.context?.projectBlockId ?? -1,
					codeBlockType: diagnostic?.context?.codeBlockType,
					...(diagnostic?.context?.projectGroupPath !== undefined
						? { projectGroupPath: diagnostic?.context?.projectGroupPath }
						: {}),
					message: diagnostic?.message || String(error) || 'Compilation failed',
				},
			]);
		} finally {
			compiling = false;
			if (compileQueued && !disposed) {
				compileQueued = false;
				void compileProject();
			}
		}
	}

	function onInputChanged(): void {
		if (disposed) return;
		++inputGeneration;
		compileQueued = false;
		scheduleRecompile();
	}

	events.on('compilationInputChanged', onInputChanged);

	return () => {
		if (disposed) return;
		disposed = true;
		scheduleRecompile.cancel();
		events.off('compilationInputChanged', onInputChanged);
		const schemas = { ...state.editorConfigSchemaContributions };
		delete schemas.compiler;
		store.set('editorConfigSchemaContributions', schemas);
	};
}
