import { serializeDiagnostic } from '@8f4e/compiler-diagnostics';
import type { EditorPluginContext, LoadingIndicatorHandle } from '@8f4e/editor-core';
import { logMessage, serializeProjectLevel } from '@8f4e/editor-state';
import type { CodeError, InfoRecord } from '@8f4e/editor-state-types';
import type { CompilerDiagnostic } from '@8f4e/language-spec';
import { WASM_MEMORY_PAGE_SIZE } from '@8f4e/language-spec';
import { hasTestEntry } from '@8f4e/test-runner';
import type { CompilerService } from './compiler-service';
import debounceTrailing from './debounce-trailing';
import { diagnosticToCodeError } from './diagnostic-presentation';
import {
	compilerEditorConfigSchemaContribution,
	getCompilerOptimizationOptions,
	getRecompileDebounceDelay,
	recompileDebounceSchemaContribution,
} from './editor-config';
import { snapshotSourceCode } from './snapshotSourceCode';

export interface CompilerDiagnostics {
	inputRevision: number;
	completedRevision: number | null;
	status: 'pending' | 'compiling' | 'ready' | 'disposed';
	compilationErrors: CompilerDiagnostic[];
	editorDirectiveErrors: CodeError[];
}

export default function installCompilation(
	{ store, events, loading }: Pick<EditorPluginContext, 'store' | 'events' | 'loading'>,
	compileCode: CompilerService['compileCode']
) {
	const state = store.getState();
	store.set('codeErrors.compiler', []);
	store.set('editorConfigSchemaContributions', {
		...state.editorConfigSchemaContributions,
		compiler: compilerEditorConfigSchemaContribution,
		compilerDebounce: recompileDebounceSchemaContribution,
	});
	let disposed = false;
	let inputGeneration = 0;
	let compiling = false;
	let compileQueued = false;
	let completedRevision: number | null = null;
	let diagnosticsCurrent = false;
	let compilationErrors: CompilerDiagnostic[] = [];
	let compilationLoading: LoadingIndicatorHandle | undefined;

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
		const indicator = loading.add({ id: 'compiler', message: 'Compiling...' });
		compilationLoading = indicator;

		store.set('codeErrors.compiler', []);
		compilationErrors = [];

		const generation = inputGeneration;
		const revision = state.compilerInputRevision;
		const isCurrent = () => !disposed && generation === inputGeneration;
		const compilationStart = performance.now();

		store.set('compiler.isCompiling', true);
		setCompilerInfo({ isCompiling: true });

		try {
			const project = serializeProjectLevel(state.codeBlockRendering.rootProject);
			const sourceCodeByBlockId = snapshotSourceCode(project);
			const compilerOptions = {
				startingMemoryAllocationUnitAddress: 0,
				includeStackAnalysis: true,
				enableAssertions: hasTestEntry(project),
				...getCompilerOptimizationOptions(state.editorConfig),
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
			events.dispatch('compilationSucceeded', { memoryRef: result.memoryRef });
			store.set('compiler.result', {
				inputRevision: revision,
				sourceCodeByBlockId,
				compiledFunctions: result.compiledFunctions,
				compiledModules: result.compiledModules,
				projectMemoryExposuresByGroupPath: result.projectMemoryExposuresByGroupPath,
				memoryPlan: result.memoryPlan,
				memoryDefaultsByModuleId: result.memoryDefaultsByModuleId,
			});
			// Let metadata subscribers load memory before runtimes resume.
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
			store.set('codeErrors.compiler', []);
			completedRevision = revision;
			diagnosticsCurrent = true;

			if (memoryReinitialized) {
				logMessage(state, 'WASM Memory instance was (re)created', 'Compiler');
				logMessage(state, 'Memory was (re)initialized', 'Compiler');
			}

			logMessage(state, 'Compilation succeeded in ' + compilationTimeMs.toFixed(2) + 'ms', 'Compiler');
			console.log('[Compiler] Compilation succeeded with config:', compilerOptions);
			indicator.done();
		} catch (error) {
			if (!isCurrent()) {
				return;
			}

			logMessage(state, 'Compilation failed', 'Compiler');
			indicator.fail();

			store.set('compiler.isCompiling', false);
			setCompilerInfo({ isCompiling: false });
			const diagnostic = serializeDiagnostic(error, 'compilation');
			compilationErrors = [diagnostic];
			store.set('codeErrors.compiler', [diagnosticToCodeError(diagnostic)]);
			completedRevision = revision;
			diagnosticsCurrent = true;
		} finally {
			indicator.cancel();
			compilationLoading = undefined;
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
		compilationLoading?.cancel();
		diagnosticsCurrent = false;
		compileQueued = false;
		scheduleRecompile();
	}

	events.on('compilationInputChanged', onInputChanged);

	const dispose = () => {
		if (disposed) return;
		disposed = true;
		compilationLoading?.cancel();
		compilationLoading = undefined;
		scheduleRecompile.cancel();
		events.off('compilationInputChanged', onInputChanged);
		const schemas = { ...state.editorConfigSchemaContributions };
		delete schemas.compiler;
		delete schemas.compilerDebounce;
		store.set('editorConfigSchemaContributions', schemas);
		const errors = { ...state.codeErrors };
		delete errors.compiler;
		store.set('codeErrors', errors);
	};
	const getDiagnostics = (): CompilerDiagnostics => ({
		inputRevision: state.compilerInputRevision,
		completedRevision,
		status: disposed
			? 'disposed'
			: compiling
				? 'compiling'
				: diagnosticsCurrent && completedRevision === state.compilerInputRevision
					? 'ready'
					: 'pending',
		compilationErrors:
			!disposed && diagnosticsCurrent && completedRevision === state.compilerInputRevision
				? structuredClone(compilationErrors)
				: [],
		editorDirectiveErrors: structuredClone(state.codeErrors['editor-directives'] ?? []),
	});
	return { dispose, getDiagnostics };
}
