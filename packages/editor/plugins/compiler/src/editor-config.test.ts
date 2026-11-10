import { EventEmitter } from 'node:events';
import type { EditorPluginContext } from '@8f4e/editor-core';
import initState, { applyCodeBlockSourceEdits, EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSuccessMessage, FakeWorker } from './__tests__/helpers';
import { createCompilerPlugin } from './index';

const cleanups: Array<() => void> = [];

function setup(installed = true) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	cleanups.push(store.dispose);
	const worker = new FakeWorker();
	const compiler = createCompilerPlugin({ createWorker: () => worker as unknown as Worker });
	const dispose = installed
		? compiler.plugin.setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				loading: store.loading,
				drawers: {} as EditorPluginContext['drawers'],
			})
		: () => {};
	cleanups.push(dispose);
	const load = (value?: string, ...directives: string[]) =>
		events.dispatch('loadProject', {
			project: {
				...EMPTY_DEFAULT_PROJECT,
				notes: [
					{
						id: 0,
						code: [
							'note config',
							...(value === undefined ? [] : [`; @config recompileDebounceDelay ${value}`]),
							...directives,
							'noteEnd',
						],
					},
				],
			},
		});
	return { store, events, worker, load, dispose };
}

describe('compiler configuration directives', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		while (cleanups.length) cleanups.pop()!();
		vi.useRealTimers();
	});

	it.each([0, 120, 500])('parses %i as a numeric delay through the contributed schema', value => {
		const test = setup();
		test.load(String(value));
		expect(test.store.getState().editorConfig.recompileDebounceDelay).toBe(value);
		expect(test.store.getState().codeErrors['editor-directives']).toEqual([]);
	});

	it.each(['-1', '10.5', 'fast'])('reports invalid delay %s as a directive diagnostic', value => {
		const test = setup();
		test.load(value);
		expect(test.store.getState().editorConfig.recompileDebounceDelay).toBeUndefined();
		expect(test.store.getState().codeErrors['editor-directives']).toEqual([
			expect.objectContaining({ message: expect.stringContaining('recompileDebounceDelay') }),
		]);
	});

	it('applies the directive delay and falls back to 500ms when the directive is removed', async () => {
		const test = setup();
		test.load('120');
		await vi.advanceTimersByTimeAsync(119);
		expect(test.worker.postedMessages).toHaveLength(0);
		// Loading new source replaces the pending debounce before the first request starts.
		test.load();
		await vi.advanceTimersByTimeAsync(499);
		expect(test.worker.postedMessages).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(test.worker.postedMessages).toHaveLength(1);
	});

	it('starts compilation after the directive-specified interval', async () => {
		const test = setup();
		test.load('120');
		await vi.advanceTimersByTimeAsync(119);
		expect(test.worker.postedMessages).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(test.worker.postedMessages).toHaveLength(1);
	});

	it('passes project optimization options to the worker and restores defaults when removed', async () => {
		const { store, events, worker, load } = setup();
		load(
			'0',
			'; @config compiler.functionInlining.enabled false',
			'; @config compiler.wasmPruning.enabled false',
			'; @config compiler.functionInlining.maxExpansionOperations 12',
			'; @config compiler.functionInlining.maxCallerGrowth 0'
		);
		await vi.advanceTimersByTimeAsync(0);
		expect(store.getState().codeErrors['editor-directives']).toEqual([]);
		expect(worker.postedMessages).toHaveLength(1);
		const defaultOptions = {
			startingMemoryAllocationUnitAddress: 0,
			includeStackAnalysis: true,
			enableAssertions: false,
		};
		expect(worker.postedMessages[0]).toHaveProperty('payload.compilerOptions', {
			...defaultOptions,
			enableFunctionInlining: false,
			enableWasmPruning: false,
			functionInlining: { maxExpansionOperations: 12, maxCallerGrowth: 0 },
		});
		worker.emitMessage(createSuccessMessage(new Uint8Array([0]), new WebAssembly.Memory({ initial: 1 })));

		const codeBlock = store.getState().codeBlockRendering.rootProject.blocks.find(block => block.blockType === 'note')!;
		const revision = store.getState().compilerInputRevision;
		applyCodeBlockSourceEdits(
			{ store, events },
			[{ codeBlock, code: ['note config', '; @config recompileDebounceDelay 0', 'noteEnd'] }],
			{ affectsCompilation: false }
		);
		expect(store.getState().compilerInputRevision).toBe(revision + 1);
		await vi.advanceTimersByTimeAsync(0);
		expect(worker.postedMessages).toHaveLength(2);
		expect(worker.postedMessages[1]).toHaveProperty('payload.compilerOptions', defaultOptions);
	});

	it.each([false, true])('announces a config edit once after its diagnostics settle (%s)', affectsCompilation => {
		const { store, events, load } = setup();
		load(
			undefined,
			'; @config compiler.functionInlining.enabled false',
			'; @config compiler.functionInlining.maxCallerGrowth -1'
		);
		const state = store.getState();
		expect(state.codeErrors['editor-directives']).toHaveLength(1);
		const errorsAtRevision = vi.fn(() => state.codeErrors['editor-directives']);
		events.on('compilationInputChanged', errorsAtRevision);
		const codeBlock = state.codeBlockRendering.rootProject.blocks.find(block => block.blockType === 'note')!;
		applyCodeBlockSourceEdits({ store, events }, [{ codeBlock, code: ['note config', 'noteEnd'] }], {
			affectsCompilation,
		});
		expect(errorsAtRevision.mock.results.map(result => result.value)).toEqual([[]]);
	});

	it('uses the same input revisions for a project load with and without inlining settings', () => {
		const baseline = setup();
		baseline.load();
		const configured = setup();
		configured.load(undefined, '; @config compiler.functionInlining.enabled false');
		expect(configured.store.getState().compilerInputRevision).toBe(baseline.store.getState().compilerInputRevision);
	});

	it.each([
		['enabled', 'maybe'],
		['maxExpansionOperations', '-1'],
		['maxCallerGrowth', '2.5'],
	])('reports invalid compiler.functionInlining.%s values as directive diagnostics', (field, value) => {
		const { store, load } = setup();
		load(undefined, `; @config compiler.functionInlining.${field} ${value}`);
		expect(store.getState().editorConfig.compiler).toBeUndefined();
		expect(store.getState().codeErrors['editor-directives']).toEqual([
			expect.objectContaining({ message: expect.stringContaining(`compiler.functionInlining.${field}`) }),
		]);
	});

	it('rejects the setting when the compiler plugin is omitted', () => {
		const test = setup(false);
		test.load('120');
		expect(test.store.getState().codeErrors['editor-directives']).toEqual([
			expect.objectContaining({ message: expect.stringContaining("unknown config path 'recompileDebounceDelay'") }),
		]);
	});

	it('removes its schemas and revalidates the settings when disposed', () => {
		const test = setup();
		test.load('120', '; @config compiler.functionInlining.enabled false');
		const revision = test.store.getState().compilerInputRevision;
		test.dispose();
		expect(test.store.getState().compilerInputRevision).toBe(revision);
		expect(test.store.getState().editorConfigSchemaContributions.compiler).toBeUndefined();
		expect(test.store.getState().editorConfigSchemaContributions.compilerDebounce).toBeUndefined();
		expect(test.store.getState().editorConfig.recompileDebounceDelay).toBeUndefined();
		expect(test.store.getState().editorConfig.compiler).toBeUndefined();
		expect(test.store.getState().codeErrors['editor-directives']).toEqual([
			expect.objectContaining({ message: expect.stringContaining("unknown config path 'recompileDebounceDelay'") }),
			expect.objectContaining({
				message: expect.stringContaining("unknown config path 'compiler.functionInlining.enabled'"),
			}),
		]);
	});
});
