import { createMemoryViewManager } from '@8f4e/editor-core';
import { readNumericValue } from '@8f4e/editor-state/memory';
import type { Scope } from '../types';

/** An installation owns its own timers and history; rendering has no effect on the sample rate. */
export function createScopeSampler(getMemory: () => WebAssembly.Memory | null) {
	const timers = new Map<Scope, ReturnType<typeof setInterval>>();
	const emptyBuffer = new ArrayBuffer(0);
	const { memoryViews, updateMemoryViews } = createMemoryViewManager(emptyBuffer);

	const sample = (scope: Scope) => {
		const memory = getMemory();
		if (!memory) return;
		updateMemoryViews(memory);
		const value = readNumericValue(scope.read, memoryViews);
		if (value === undefined || !Number.isFinite(value)) return;
		scope.history.push(value);
		if (scope.history.length > scope.width) scope.history.shift();
	};

	const sync = (scopes: readonly Scope[]) => {
		const active = new Set(scopes);
		for (const [scope, timer] of timers) {
			if (active.has(scope)) continue;
			clearInterval(timer);
			timers.delete(scope);
		}
		for (const scope of active) {
			if (timers.has(scope)) continue;
			timers.set(
				scope,
				setInterval(() => sample(scope), 1000 / scope.sampleRate)
			);
		}
		if (!timers.size) updateMemoryViews(emptyBuffer);
	};

	return {
		sync,
		dispose: () => {
			for (const timer of timers.values()) clearInterval(timer);
			timers.clear();
			updateMemoryViews(emptyBuffer);
		},
	};
}
