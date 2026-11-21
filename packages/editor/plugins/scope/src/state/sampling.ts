import { createMemoryViewManager } from '@8f4e/editor-core';
import { readNumericValue } from '@8f4e/editor-state/memory';
import type { Scope } from '../types';

interface SamplingGroup {
	scopes: readonly Scope[];
	timer: ReturnType<typeof setInterval>;
}

/** An installation owns its own timers and history; rendering has no effect on the sample rate. */
export function createScopeSampler(getMemory: () => WebAssembly.Memory | null) {
	const groups = new Map<number, SamplingGroup>();
	const emptyBuffer = new ArrayBuffer(0);
	const { memoryViews, updateMemoryViews } = createMemoryViewManager(emptyBuffer);

	const sample = (scopes: readonly Scope[]) => {
		const memory = getMemory();
		if (!memory) return;
		updateMemoryViews(memory);
		for (const scope of scopes) {
			const value = readNumericValue(scope.read, memoryViews);
			if (value === undefined || !Number.isFinite(value)) continue;
			scope.history.push(value);
			if (scope.history.length > scope.width) scope.history.shift();
		}
	};

	const sync = (scopes: readonly Scope[]) => {
		const activeByRate = new Map<number, Scope[]>();
		for (const scope of new Set(scopes)) {
			const active = activeByRate.get(scope.sampleRate);
			if (active) active.push(scope);
			else activeByRate.set(scope.sampleRate, [scope]);
		}

		for (const [rate, group] of groups) {
			if (activeByRate.has(rate)) continue;
			clearInterval(group.timer);
			groups.delete(rate);
		}
		for (const [rate, active] of activeByRate) {
			const existing = groups.get(rate);
			if (existing) {
				// Retain the timer's cadence when scopes join, leave or refresh their layout.
				existing.scopes = active;
				continue;
			}
			const group: SamplingGroup = {
				scopes: active,
				timer: setInterval(() => sample(group.scopes), 1000 / rate),
			};
			groups.set(rate, group);
		}
		if (!groups.size) updateMemoryViews(emptyBuffer);
	};

	return {
		sync,
		dispose: () => {
			for (const group of groups.values()) clearInterval(group.timer);
			groups.clear();
			updateMemoryViews(emptyBuffer);
		},
	};
}
