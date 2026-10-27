import { describe, expect, it } from 'vitest';
import { createWaveDirectiveData } from './data';

describe('wave arguments', () => {
	it.each([
		{ args: ['start', '16', 'playhead'], length: 16, pointerMemoryId: 'playhead' },
		{ args: ['&samples', 'length'], length: 'length', pointerMemoryId: undefined },
		{ args: ['&samples', 'count(samples)'], length: 'count(samples)', pointerMemoryId: undefined },
	])('reads pointer and count arguments from $args', ({ args, length, pointerMemoryId }) => {
		expect(createWaveDirectiveData(args, 7)).toEqual({
			startAddressMemoryId: args[0],
			length,
			pointerMemoryId,
			lineNumber: 7,
		});
	});
	it.each([
		{ args: [] },
		{ args: ['start'] },
		{ args: ['start', '0'] },
		{ args: ['start', '-1'] },
		{ args: ['*start', '16'] },
		{ args: ['start', '16', '*playhead'] },
		{ args: ['start', '16', 'playhead', 'extra'] },
	])('rejects invalid arguments $args', ({ args }) => {
		expect(createWaveDirectiveData(args, 0)).toBeUndefined();
	});
});
