import type { CompileAndUpdateMemoryResult } from '@8f4e/language-spec';
import { vi } from 'vitest';

type MessageListener = (event: MessageEvent) => void;

export class FakeWorker {
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

export function createSuccessMessage(
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
