import type { CompileAndUpdateMemoryResult, ProjectObjectModel } from '@8f4e/language-spec';
import { describe, expect, it, vi } from 'vitest';
import { createCompilerService } from './compiler-callback';

type MessageListener = (event: MessageEvent) => void;

class FakeWorker {
	readonly postedMessages: unknown[] = [];
	readonly terminate = vi.fn();
	private readonly messageListeners = new Set<MessageListener>();

	addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
		if (type === 'message' && typeof listener === 'function') {
			this.messageListeners.add(listener as MessageListener);
		}
	}

	removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
		if (type === 'message' && typeof listener === 'function') {
			this.messageListeners.delete(listener as MessageListener);
		}
	}

	postMessage(message: unknown): void {
		this.postedMessages.push(message);
	}

	emitMessage(data: unknown): void {
		for (const listener of this.messageListeners) {
			listener({ data } as MessageEvent);
		}
	}
}

function createSuccessMessage(
	codeBuffer: Uint8Array,
	memoryRef: WebAssembly.Memory,
	compilationId = 0
): {
	type: 'success';
	compilationId: number;
	payload: CompileAndUpdateMemoryResult;
} {
	return {
		type: 'success',
		compilationId,
		payload: {
			assertionSites: [],
			memoryRef,
			codeBuffer,
			compiledModules: {},
			memoryPlan: { modules: {}, moduleList: [] },
			memoryDefaultsByModuleId: {},
			projectMemoryExposuresByGroupPath: {},
			requiredMemoryBytes: 0,
			allocatedMemoryBytes: 65536,
			astCacheStats: { hits: 0, misses: 0 },
			memoryAction: { action: 'reused' },
			compiledFunctions: {},
		},
	};
}

describe('compiler service', () => {
	it('writes integers and floats to current memory after replacement and growth', async () => {
		const worker = new FakeWorker();
		const service = createCompilerService({ createWorker: () => worker as unknown as Worker });
		service.writeMemory(1, 7, true);
		const first = new WebAssembly.Memory({ initial: 1, maximum: 2 });
		const compile = service.compileCode({} as ProjectObjectModel, {});
		worker.emitMessage(createSuccessMessage(new Uint8Array(), first));
		await compile;
		service.writeMemory(1, 7, true);
		service.writeMemory(2, 0.5, false);
		expect(new Int32Array(first.buffer)[1]).toBe(7);
		expect(new Float32Array(first.buffer)[2]).toBe(0.5);
		first.grow(1);
		service.writeMemory(16384, 42, true);
		expect(new Int32Array(first.buffer)[16384]).toBe(42);
		const second = new WebAssembly.Memory({ initial: 1 });
		const recompile = service.compileCode({} as ProjectObjectModel, {});
		worker.emitMessage(createSuccessMessage(new Uint8Array(), second, 1));
		await recompile;
		service.writeMemory(1, 9, true);
		expect(new Int32Array(second.buffer)[1]).toBe(9);
		expect(new Int32Array(first.buffer)[1]).toBe(7);
		service.dispose();
	});

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
