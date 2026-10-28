import type {
	EditorConfigSchemaContribution,
	LazyRuntimeRegistryEntry,
	RuntimeRegistry,
	RuntimeRegistryEntry,
} from '@8f4e/editor-core';
import type { createCompilerPlugin } from '@8f4e/editor-plugin-compiler';

type CompilerArtifacts = Pick<
	ReturnType<typeof createCompilerPlugin>,
	'getCodeBuffer' | 'getMemory' | 'getAssertionSites'
>;

/** Advertises a schema before loading; the runtime coordinator owns loading and publication. */
function createLazyRuntimeEntry(
	id: string,
	editorConfigSchema: EditorConfigSchemaContribution | undefined,
	load: () => Promise<RuntimeRegistryEntry>
): LazyRuntimeRegistryEntry {
	return {
		id,
		editorConfigSchema: editorConfigSchema && { ...editorConfigSchema, schema: { type: 'object' } },
		load,
	};
}

/**
 * Creates a runtime registry for one editor instance.
 * Maps runtime IDs to their editor-config schema contributions and factory functions.
 * Runtimes are lazy-loaded on first selection. Each runtime starts with a minimal stub schema
 * and replaces it with the full schema after loading.
 */
export function createRuntimeRegistry(
	{ getCodeBuffer, getMemory, getAssertionSites }: CompilerArtifacts,
	sharedAudioContext?: AudioContext
): RuntimeRegistry {
	return {
		TestRuntime: createLazyRuntimeEntry('TestRuntime', undefined, async () => {
			const [{ createTestRuntimeDef }, { default: TestWorker }] = await Promise.all([
				import('@8f4e/runtime-test-runner/runtime-def'),
				import('@8f4e/runtime-test-runner?worker'),
			]);
			return createTestRuntimeDef(getCodeBuffer, getMemory, getAssertionSites, TestWorker);
		}),
		WebWorkerRuntime: createLazyRuntimeEntry(
			'WebWorkerRuntime',
			{ root: 'workerRuntime', defaults: { sampleRate: 50 }, schema: { type: 'object' } },
			async () => {
				const [{ createWebWorkerRuntimeDef }, { default: WebWorkerRuntime }] = await Promise.all([
					import('@8f4e/runtime-web-worker/runtime-def'),
					import('@8f4e/runtime-web-worker?worker'),
				]);
				return createWebWorkerRuntimeDef(getCodeBuffer, getMemory, WebWorkerRuntime);
			}
		),

		AudioWorkletRuntime: createLazyRuntimeEntry(
			'AudioWorkletRuntime',
			{ root: 'audioRuntime', defaults: { sampleRate: 48000 }, schema: { type: 'object' } },
			async () => {
				const [{ createAudioWorkletRuntimeDef }, { default: audioWorkletUrl }] = await Promise.all([
					import('@8f4e/runtime-audio-worklet/runtime-def'),
					import('@8f4e/runtime-audio-worklet/worklet?url'),
				]);
				return createAudioWorkletRuntimeDef(getCodeBuffer, getMemory, audioWorkletUrl, sharedAudioContext);
			}
		),
	};
}
