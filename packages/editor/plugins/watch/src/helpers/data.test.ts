import { describe, expect, it } from 'vitest';
import { createWatchDirectiveData } from './data';

describe('watch directive data', () => {
	it.each([
		{ target: 'value', memoryId: 'value', displayFormat: 'decimal', showEndAddress: false },
		{ target: '0xvalue', memoryId: 'value', displayFormat: 'hex', showEndAddress: false },
		{ target: '0bvalue', memoryId: 'value', displayFormat: 'binary', showEndAddress: false },
		{ target: 'value&', memoryId: 'value', displayFormat: 'decimal', showEndAddress: true },
		{ target: '0x*pointer', memoryId: '*pointer', displayFormat: 'hex', showEndAddress: false },
		{ target: '0b*pointer&', memoryId: '*pointer', displayFormat: 'binary', showEndAddress: true },
		{ target: '&buffer[2]', memoryId: '&buffer[2]', displayFormat: 'decimal', showEndAddress: false },
	])('interprets presentation arguments for $target', ({ target, ...expected }) => {
		expect(createWatchDirectiveData([target], 3)).toEqual({ ...expected, lineNumber: 3 });
	});

	it.each([
		{ args: [], memoryId: 'value', displayFormat: 'decimal', showEndAddress: false },
		{ args: ['other'], memoryId: 'other', displayFormat: 'decimal', showEndAddress: false },
		{ args: ['0xother'], memoryId: 'other', displayFormat: 'hex', showEndAddress: false },
		{ args: ['0x'], memoryId: 'value', displayFormat: 'hex', showEndAddress: false },
		{ args: ['0b'], memoryId: 'value', displayFormat: 'binary', showEndAddress: false },
		{ args: ['&'], memoryId: '&value', displayFormat: 'decimal', showEndAddress: false },
		{ args: ['*&'], memoryId: '*value', displayFormat: 'decimal', showEndAddress: true },
		{ args: ['0x[2]'], memoryId: 'value[2]', displayFormat: 'hex', showEndAddress: false },
	])('infers a declaration target while honoring explicit arguments: $args', ({ args, ...expected }) => {
		expect(createWatchDirectiveData(args, 4, 'int value 7 ; @watch')).toEqual({ ...expected, lineNumber: 4 });
	});

	it.each(['int 1', 'int 0', 'int', 'float', 'int*'])('infers anonymous storage for %s', declaration => {
		expect(createWatchDirectiveData(['0x'], 8, declaration)).toEqual({
			memoryId: '__anonymous__8',
			lineNumber: 8,
			displayFormat: 'hex',
			showEndAddress: false,
		});
	});

	it('omits a watch without an explicit or inferred target', () => {
		expect(createWatchDirectiveData([], 0)).toBeUndefined();
		expect(createWatchDirectiveData([], 0, 'push 1')).toBeUndefined();
	});
});
