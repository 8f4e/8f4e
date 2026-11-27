import type { ScopeHistory } from '../types';

/** Capacity is a positive integer equal to the widget's width in pixels. */
export function createScopeHistory(capacity: number): ScopeHistory {
	return { values: new Float64Array(capacity), count: 0, writeIndex: 0 };
}

/** Overwrite one slot without shifting or allocating sample storage. */
export function writeScopeSample(history: ScopeHistory, value: number): void {
	const capacity = history.values.length;
	history.values[history.writeIndex] = value;
	history.writeIndex++;
	if (history.writeIndex === capacity) history.writeIndex = 0;
	if (history.count < capacity) history.count++;
}

/** Only a width change reallocates; copy the most recent samples in chronological order into the new ring. */
export function resizeScopeHistory(history: ScopeHistory, capacity: number): ScopeHistory {
	const previousCapacity = history.values.length;
	if (previousCapacity === capacity) return history;
	const next = createScopeHistory(capacity);
	const count = Math.min(history.count, capacity);
	const start = (history.writeIndex + previousCapacity - count) % previousCapacity;
	const firstLength = Math.min(count, previousCapacity - start);
	next.values.set(history.values.subarray(start, start + firstLength));
	next.values.set(history.values.subarray(0, count - firstLength), firstLength);
	next.count = count;
	next.writeIndex = count === capacity ? 0 : count;
	return next;
}
