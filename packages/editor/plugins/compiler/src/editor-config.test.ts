import { EventEmitter } from 'node:events';
import type { EditorPluginContext } from '@8f4e/editor-core';
import initState, { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeWorker } from './__tests__/helpers';
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
				drawers: {} as EditorPluginContext['drawers'],
			})
		: () => {};
	cleanups.push(dispose);
	const load = (value?: string) =>
		events.dispatch('loadProject', {
			project: {
				...EMPTY_DEFAULT_PROJECT,
				notes: [
					{
						id: 0,
						code: [
							'note config',
							...(value === undefined ? [] : [`; @config recompileDebounceDelay ${value}`]),
							'noteEnd',
						],
					},
				],
			},
		});
	return { store, worker, load, dispose };
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
		expect(test.store.getState().codeErrors.editorDirectiveErrors).toEqual([]);
	});

	it.each(['-1', '10.5', 'fast'])('reports invalid delay %s as a directive diagnostic', value => {
		const test = setup();
		test.load(value);
		expect(test.store.getState().editorConfig.recompileDebounceDelay).toBeUndefined();
		expect(test.store.getState().codeErrors.editorDirectiveErrors).toEqual([
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

	it('rejects the setting when the compiler plugin is omitted', () => {
		const test = setup(false);
		test.load('120');
		expect(test.store.getState().codeErrors.editorDirectiveErrors).toEqual([
			expect.objectContaining({ message: expect.stringContaining("unknown config path 'recompileDebounceDelay'") }),
		]);
	});

	it('removes its schema and revalidates the setting when disposed', () => {
		const test = setup();
		test.load('120');
		test.dispose();
		expect(test.store.getState().editorConfigSchemaContributions.compiler).toBeUndefined();
		expect(test.store.getState().editorConfig.recompileDebounceDelay).toBeUndefined();
		expect(test.store.getState().codeErrors.editorDirectiveErrors).toEqual([
			expect.objectContaining({ message: expect.stringContaining("unknown config path 'recompileDebounceDelay'") }),
		]);
	});
});
