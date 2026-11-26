import { expect, it } from 'vitest';
import { createScopeHistory, resizeScopeHistory, writeScopeSample } from './history';

it('writes in place and wraps to overwrite the oldest storage slots', () => {
	const history = createScopeHistory(4);
	const storage = history.values;
	for (const value of [1, 2, 3, 4, 5, 6]) writeScopeSample(history, value);
	expect(history.values).toBe(storage);
	expect(Array.from(history.values)).toEqual([5, 6, 3, 4]);
	expect(history.count).toBe(4);
	expect(history.writeIndex).toBe(2);
	expect(resizeScopeHistory(history, 4)).toBe(history);
});

it('retains the newest samples in chronological order when shrinking a wrapped ring', () => {
	const history = createScopeHistory(4);
	for (const value of [1, 2, 3, 4, 5, 6]) writeScopeSample(history, value);
	const smaller = resizeScopeHistory(history, 3);
	expect(Array.from(smaller.values)).toEqual([4, 5, 6]);
	expect(smaller.count).toBe(3);
	expect(smaller.writeIndex).toBe(0);
	writeScopeSample(smaller, 7);
	expect(Array.from(smaller.values)).toEqual([7, 5, 6]);
});

it('grows a wrapped ring and resumes writing after the retained samples', () => {
	const history = createScopeHistory(4);
	for (const value of [1, 2, 3, 4, 5, 6]) writeScopeSample(history, value);
	const larger = resizeScopeHistory(history, 6);
	expect(Array.from(larger.values.subarray(0, larger.count))).toEqual([3, 4, 5, 6]);
	expect(larger.count).toBe(4);
	expect(larger.writeIndex).toBe(4);
	writeScopeSample(larger, 7);
	writeScopeSample(larger, 8);
	expect(Array.from(larger.values)).toEqual([3, 4, 5, 6, 7, 8]);
	expect(larger.writeIndex).toBe(0);
});

it('retains only populated slots when resizing a partially filled history', () => {
	const history = createScopeHistory(5);
	writeScopeSample(history, -1);
	writeScopeSample(history, 1);
	const smaller = resizeScopeHistory(history, 1);
	expect(Array.from(smaller.values)).toEqual([1]);
	expect(smaller.count).toBe(1);
	const larger = resizeScopeHistory(history, 8);
	expect(Array.from(larger.values.subarray(0, larger.count))).toEqual([-1, 1]);
	expect(larger.count).toBe(2);
	expect(larger.writeIndex).toBe(2);
});
