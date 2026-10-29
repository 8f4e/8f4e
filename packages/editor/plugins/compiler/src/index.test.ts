import { EventEmitter } from 'node:events';
import type { EditorPluginContext, ProgramArtifacts } from '@8f4e/editor-core';
import initState, { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSuccessMessage, FakeWorker } from './__tests__/helpers';
import { createCompilerPlugin } from './index';

const disposers: Array<() => void> = [];

function setup() {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {}, runtimeRegistry: {}, initialEditorMode: 'edit' });
	const worker = new FakeWorker();
	const createWorker = vi.fn(() => worker as unknown as Worker);
	const compiler = createCompilerPlugin({ createWorker });
	const dispose = compiler.plugin.setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		drawers: {} as EditorPluginContext['drawers'],
	});
	disposers.push(() => {
		dispose();
		store.dispose();
	});
	const accepted = vi.fn();
	events.on('compilationSucceeded', accepted);
	return { compiler, store, events, worker, createWorker, dispose, accepted };
}

async function startCompilation(test: ReturnType<typeof setup>) {
	test.events.dispatch('loadProject', {
		project: { ...EMPTY_DEFAULT_PROJECT, modules: [{ id: 1, entry: 'main', code: ['module main', 'moduleEnd'] }] },
	});
	await vi.advanceTimersByTimeAsync(500);
}

describe('compiler plugin', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		while (disposers.length) disposers.pop()!();
		vi.useRealTimers();
	});

	it('returns stable handles before installation and creates its worker only for compilation', async () => {
		const test = setup();
		expect(test.createWorker).not.toHaveBeenCalled();
		expect(test.compiler.getMemory()).toBeNull();
		expect(test.compiler.getCodeBuffer()).toHaveLength(0);
		expect(test.compiler.getAssertionSites()).toBeUndefined();
		test.compiler.writeMemory(0, 42, true);
		await startCompilation(test);
		expect(test.createWorker).toHaveBeenCalledOnce();
		expect(test.worker.postedMessages).toContainEqual(
			expect.objectContaining({
				type: 'compile',
				payload: expect.objectContaining({
					project: expect.objectContaining({
						modules: [expect.objectContaining({ code: ['module main', 'moduleEnd'] })],
					}),
				}),
			})
		);
	});

	it('publishes current handles and rendering artifacts before memory consumers and runtimes react', async () => {
		const test = setup();
		await startCompilation(test);
		const memory = new WebAssembly.Memory({ initial: 1 });
		const codeBuffer = new Uint8Array([1, 2]);
		const order: string[] = [];
		test.events.on('compilationSucceeded', (result: ProgramArtifacts) => {
			expect(test.compiler.getMemory()).toBe(result.memoryRef);
			expect(test.compiler.getCodeBuffer()).toBe(result.codeBuffer);
			order.push('rendering');
		});
		test.store.subscribe('compiler.memoryPlan', () => {
			expect(test.compiler.getMemory()).toBe(memory);
			test.compiler.writeMemory(1, 42, true);
			order.push('memory');
		});
		test.store.subscribe('compiler.isCompiling', () => {
			if (!test.store.getState().compiler.isCompiling) order.push('runtime');
		});
		test.worker.emitMessage(createSuccessMessage(codeBuffer, memory));
		await vi.advanceTimersByTimeAsync(0);
		expect(order).toEqual(['rendering', 'memory', 'runtime']);
		expect(new Int32Array(memory.buffer)[1]).toBe(42);
		expect(test.store.getState().info.compiler).toMatchObject({ wasmByteCodeBytes: 2, isCompiling: false });
	});

	it('reports which input produced diagnostics and does not present old errors as current during debounce', async () => {
		const test = setup();
		await startCompilation(test);
		expect(test.compiler.getDiagnostics()).toMatchObject({ status: 'compiling', completedRevision: null });
		test.worker.emitMessage({
			type: 'compilationError',
			compilationId: 0,
			payload: { message: 'Invalid source', line: { lineNumber: 1 }, context: {} },
		});
		await vi.advanceTimersByTimeAsync(0);
		const current = test.compiler.getDiagnostics()!;
		expect(current.status).toBe('ready');
		expect(current.completedRevision).toBe(current.inputRevision);
		expect(current.compilationErrors[0].message).toBe('Invalid source');
		current.compilationErrors[0].message = 'mutated';
		expect(test.compiler.getDiagnostics()!.compilationErrors[0].message).toBe('Invalid source');
		test.events.dispatch('compilationInputChanged');
		expect(test.compiler.getDiagnostics()).toMatchObject({ status: 'pending', compilationErrors: [] });
		test.store.set('compilerInputRevision', test.store.getState().compilerInputRevision + 1);
		expect(test.compiler.getDiagnostics()).toMatchObject({ status: 'pending', compilationErrors: [] });
		test.dispose();
		expect(test.compiler.getDiagnostics()).toMatchObject({ status: 'disposed' });
	});

	it('rejects an obsolete result even while the next compilation is still being debounced', async () => {
		const test = setup();
		await startCompilation(test);
		test.events.dispatch('compilationInputChanged');
		test.worker.emitMessage(createSuccessMessage(new Uint8Array([1]), new WebAssembly.Memory({ initial: 1 })));
		await vi.advanceTimersByTimeAsync(0);
		expect(test.compiler.getMemory()).toBeNull();
		expect(test.compiler.getCodeBuffer()).toHaveLength(0);
		expect(test.compiler.getAssertionSites()).toBeUndefined();
		expect(test.accepted).not.toHaveBeenCalled();
		expect(test.store.getState().compiler.isCompiling).toBe(true);
		await vi.advanceTimersByTimeAsync(500);
		const memory = new WebAssembly.Memory({ initial: 1 });
		test.worker.emitMessage(createSuccessMessage(new Uint8Array([2]), memory, 1));
		await vi.advanceTimersByTimeAsync(0);
		expect(test.compiler.getMemory()).toBe(memory);
		expect(test.accepted).toHaveBeenCalledOnce();
		expect(test.store.getState().compiler.isCompiling).toBe(false);
	});

	it.each(['success', 'compilationError'])(
		'waits for an obsolete %s before starting the latest queued compilation',
		async type => {
			const test = setup();
			await startCompilation(test);
			test.events.dispatch('compilationInputChanged');
			await vi.advanceTimersByTimeAsync(500);
			test.events.dispatch('compilationInputChanged');
			await vi.advanceTimersByTimeAsync(500);
			expect(test.worker.postedMessages).toHaveLength(1);
			test.worker.emitMessage(
				type === 'success'
					? createSuccessMessage(new Uint8Array([1]), new WebAssembly.Memory({ initial: 1 }))
					: { type, compilationId: 0, payload: { message: 'Obsolete failure', line: { lineNumber: 1 }, context: {} } }
			);
			await vi.advanceTimersByTimeAsync(0);
			expect(test.worker.postedMessages).toHaveLength(2);
			expect(test.accepted).not.toHaveBeenCalled();
			expect(test.store.getState().codeErrors.compilationErrors).toEqual([]);
			const memory = new WebAssembly.Memory({ initial: 1 });
			test.worker.emitMessage(createSuccessMessage(new Uint8Array([2]), memory, 1));
			await vi.advanceTimersByTimeAsync(0);
			expect(test.compiler.getMemory()).toBe(memory);
			expect(test.compiler.getCodeBuffer()).toEqual(new Uint8Array([2]));
			expect(test.accepted).toHaveBeenCalledOnce();
		}
	);

	it('respects the latest debounce interval when an earlier compilation was already queued', async () => {
		const test = setup();
		await startCompilation(test);
		test.events.dispatch('compilationInputChanged');
		await vi.advanceTimersByTimeAsync(500);
		test.events.dispatch('compilationInputChanged');
		test.worker.emitMessage(createSuccessMessage(new Uint8Array([1]), new WebAssembly.Memory({ initial: 1 })));
		await vi.advanceTimersByTimeAsync(499);
		expect(test.worker.postedMessages).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(test.worker.postedMessages).toHaveLength(2);
	});

	it('cancels scheduled work and rejects pending worker requests without publishing after disposal', async () => {
		const test = setup();
		await startCompilation(test);
		test.events.dispatch('compilationInputChanged');
		test.dispose();
		const set = vi.spyOn(test.store, 'set');
		test.events.dispatch('compilationInputChanged');
		test.worker.emitMessage(createSuccessMessage(new Uint8Array([1]), new WebAssembly.Memory({ initial: 1 })));
		await vi.advanceTimersByTimeAsync(1000);
		expect(test.worker.terminate).toHaveBeenCalledOnce();
		expect(test.worker.postedMessages).toHaveLength(1);
		expect(test.accepted).not.toHaveBeenCalled();
		expect(set).not.toHaveBeenCalled();
	});
});
