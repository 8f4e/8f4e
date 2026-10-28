import type { ProjectObjectModel } from '@8f4e/language-spec';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSuccessMessage, FakeWorker } from './__tests__/helpers';
import { createCompilerService } from './compiler-service';

describe('compiler service', () => {
	afterEach(() => vi.unstubAllGlobals());

	it.each([false, true])(
		'reuses memory-write views across repeated writes and refreshes on growth/replacement (shared=%s)',
		async shared => {
			const worker = new FakeWorker();
			const service = createCompilerService({ createWorker: () => worker as unknown as Worker });
			const NativeInt32Array = Int32Array;
			const NativeFloat32Array = Float32Array;
			const int32Allocations = vi.fn();
			const float32Allocations = vi.fn();
			vi.stubGlobal(
				'Int32Array',
				new Proxy(NativeInt32Array, {
					construct(target, args, newTarget) {
						int32Allocations();
						return Reflect.construct(target, args, newTarget);
					},
				})
			);
			vi.stubGlobal(
				'Float32Array',
				new Proxy(NativeFloat32Array, {
					construct(target, args, newTarget) {
						float32Allocations();
						return Reflect.construct(target, args, newTarget);
					},
				})
			);
			service.writeMemory(1, 7, true);
			expect(int32Allocations).not.toHaveBeenCalled();
			expect(float32Allocations).not.toHaveBeenCalled();
			const first = new WebAssembly.Memory({ initial: 1, maximum: 2, shared });
			const compile = service.compileCode({} as ProjectObjectModel, {});
			worker.emitMessage(createSuccessMessage(new Uint8Array(), first));
			await compile;
			for (let i = 0; i < 100; i++) {
				service.writeMemory(1, 7, true);
				service.writeMemory(2, 0.5, false);
			}
			expect(int32Allocations).toHaveBeenCalledTimes(1);
			expect(float32Allocations).toHaveBeenCalledTimes(1);
			expect(new NativeInt32Array(first.buffer)[1]).toBe(7);
			expect(new NativeFloat32Array(first.buffer)[2]).toBe(0.5);
			first.grow(1);
			for (let i = 0; i < 100; i++) {
				service.writeMemory(16384, 42, true);
				service.writeMemory(16385, 0.25, false);
			}
			expect(int32Allocations).toHaveBeenCalledTimes(2);
			expect(float32Allocations).toHaveBeenCalledTimes(2);
			expect(new NativeInt32Array(first.buffer)[16384]).toBe(42);
			expect(new NativeFloat32Array(first.buffer)[16385]).toBe(0.25);
			const second = new WebAssembly.Memory({ initial: 1, maximum: 1, shared });
			const recompile = service.compileCode({} as ProjectObjectModel, {});
			worker.emitMessage(createSuccessMessage(new Uint8Array(), second, 1));
			await recompile;
			for (let i = 0; i < 100; i++) {
				service.writeMemory(1, 9, true);
				service.writeMemory(2, 0.75, false);
			}
			expect(int32Allocations).toHaveBeenCalledTimes(3);
			expect(float32Allocations).toHaveBeenCalledTimes(3);
			expect(new NativeInt32Array(second.buffer)[1]).toBe(9);
			expect(new NativeFloat32Array(second.buffer)[2]).toBe(0.75);
			expect(new NativeInt32Array(first.buffer)[1]).toBe(7);
			expect(new NativeFloat32Array(first.buffer)[2]).toBe(0.5);
			service.dispose();
		}
	);

	it('publishes assertion metadata only for a successful current compilation', async () => {
		const worker = new FakeWorker();
		const service = createCompilerService({ createWorker: () => worker as unknown as Worker });
		const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
		const codeBuffer = new Uint8Array([1]);
		const first = service.compileCode({} as ProjectObjectModel, {});
		expect(service.getAssertionSites()).toBeUndefined();
		worker.emitMessage(createSuccessMessage(codeBuffer, memory));
		expect(await first).toMatchObject({ codeBuffer, memoryRef: memory });
		expect(service.getAssertionSites()).toEqual([]);
		expect(service.getCodeBuffer()).toBe(codeBuffer);
		expect(service.getMemory()).toBe(memory);

		const second = service.compileCode({} as ProjectObjectModel, {});
		expect(service.getAssertionSites()).toBeUndefined();
		worker.emitMessage({ type: 'compilationError', compilationId: 1, payload: { message: 'syntax error' } });
		await expect(second).rejects.toMatchObject({ message: 'syntax error' });
		expect(service.getAssertionSites()).toBeUndefined();
		service.dispose();
	});

	it('keeps code, memory, and assertion sites from the latest compilation', async () => {
		const worker = new FakeWorker();
		const service = createCompilerService({ createWorker: () => worker as unknown as Worker });
		const memory = new WebAssembly.Memory({ initial: 1 });
		const first = service.compileCode({} as ProjectObjectModel, {});
		const second = service.compileCode({} as ProjectObjectModel, {});
		const codeBuffer = new Uint8Array([2]);
		worker.emitMessage(createSuccessMessage(codeBuffer, memory, 1));
		await second;
		const current = service.getAssertionSites();
		worker.emitMessage(createSuccessMessage(new Uint8Array([1]), new WebAssembly.Memory({ initial: 1 }), 0));
		await first;
		expect(service.getAssertionSites()).toBe(current);
		expect(service.getCodeBuffer()).toBe(codeBuffer);
		expect(service.getMemory()).toBe(memory);
		service.dispose();
	});

	it('does not expose assertion sites when assertions are disabled', async () => {
		const worker = new FakeWorker();
		const service = createCompilerService({ createWorker: () => worker as unknown as Worker });
		const compilation = service.compileCode({} as ProjectObjectModel, {});
		const success = createSuccessMessage(new Uint8Array([1]), new WebAssembly.Memory({ initial: 1 }));
		worker.emitMessage({ ...success, payload: { ...success.payload, assertionSites: undefined } });
		await compilation;
		expect(service.getAssertionSites()).toBeUndefined();
		service.dispose();
	});

	it('isolates workers, include resolution, memory, and code buffers between instances', async () => {
		const workers: FakeWorker[] = [];
		const createWorker = () => {
			const worker = new FakeWorker();
			workers.push(worker);
			return worker as unknown as Worker;
		};
		const firstService = createCompilerService({ createWorker, resolveInclude: includeId => `first:${includeId}` });
		const secondService = createCompilerService({ createWorker, resolveInclude: includeId => `second:${includeId}` });
		const firstMemory = new WebAssembly.Memory({ initial: 1 });
		const secondMemory = new WebAssembly.Memory({ initial: 1 });
		const firstCodeBuffer = new Uint8Array([1, 2, 3]);
		const secondCodeBuffer = new Uint8Array([4, 5]);
		const project = {} as ProjectObjectModel;

		const firstCompilation = firstService.compileCode(project, {});
		const secondCompilation = secondService.compileCode(project, {});

		expect(workers).toHaveLength(2);

		workers[0].emitMessage({ type: 'resolveInclude', payload: { requestId: 10, includeId: 'module' } });
		workers[1].emitMessage({ type: 'resolveInclude', payload: { requestId: 20, includeId: 'module' } });
		await vi.waitFor(() => {
			expect(workers[0].postedMessages).toContainEqual({
				type: 'resolveIncludeResult',
				payload: { requestId: 10, source: 'first:module' },
			});
			expect(workers[1].postedMessages).toContainEqual({
				type: 'resolveIncludeResult',
				payload: { requestId: 20, source: 'second:module' },
			});
		});

		workers[0].emitMessage(createSuccessMessage(firstCodeBuffer, firstMemory));
		workers[1].emitMessage(createSuccessMessage(secondCodeBuffer, secondMemory));
		await Promise.all([firstCompilation, secondCompilation]);

		expect(firstService.getMemory()).toBe(firstMemory);
		expect(secondService.getMemory()).toBe(secondMemory);
		expect(firstService.getCodeBuffer()).toBe(firstCodeBuffer);
		expect(secondService.getCodeBuffer()).toBe(secondCodeBuffer);
		firstService.writeMemory(1, 11, true);
		secondService.writeMemory(1, 22, true);
		firstService.writeMemory(2, 33, true);
		expect(Array.from(new Int32Array(firstMemory.buffer).subarray(1, 3))).toEqual([11, 33]);
		expect(Array.from(new Int32Array(secondMemory.buffer).subarray(1, 3))).toEqual([22, 0]);

		firstService.dispose();
		expect(workers[0].terminate).toHaveBeenCalledOnce();
		expect(workers[1].terminate).not.toHaveBeenCalled();

		secondService.dispose();
		expect(workers[1].terminate).toHaveBeenCalledOnce();
	});

	it('does not recreate its worker after disposal', async () => {
		const worker = new FakeWorker();
		const service = createCompilerService({ createWorker: () => worker as unknown as Worker });
		service.dispose();

		await expect(service.compileCode({} as ProjectObjectModel, {})).rejects.toThrow(
			'Compiler service has been disposed'
		);
		expect(worker.terminate).not.toHaveBeenCalled();
	});

	it('rejects pending compilations when disposed', async () => {
		const worker = new FakeWorker();
		const service = createCompilerService({ createWorker: () => worker as unknown as Worker });
		const compilation = service.compileCode({} as ProjectObjectModel, {});

		service.dispose();

		await expect(compilation).rejects.toThrow('Compiler service has been disposed');
		expect(worker.terminate).toHaveBeenCalledOnce();
	});
});
