import { describe, expect, it } from 'vitest';
import { createWatchDirectiveData } from './data';

describe('watch directive data', () => {
	it.each([
		{ target: 'value', memoryId: 'value', displayFormat: 'decimal', showEndAddress: false },
		{ target: '0xvalue', memoryId: 'value', displayFormat: 'hex', showEndAddress: false },
		{ target: '0bvalue', memoryId: 'value', displayFormat: 'binary', showEndAddress: false },
		{ target: 'end(value)', memoryId: 'value', displayFormat: 'decimal', showEndAddress: true },
		{ target: '0x*pointer', memoryId: '*pointer', displayFormat: 'hex', showEndAddress: false },
		{ target: '0bend(*pointer)', memoryId: '*pointer', displayFormat: 'binary', showEndAddress: true },
		{ target: '&buffer[2]', memoryId: '&buffer[2]', displayFormat: 'decimal', showEndAddress: false },
	])('interprets presentation arguments for $target', ({ target, ...expected }) => {
		expect(createWatchDirectiveData([target], 3)).toEqual({ ...expected, lineNumber: 3 });
	});

	it.each([
		{ args: [], displayFormat: 'decimal' },
		{ args: ['0x'], displayFormat: 'hex' },
		{ args: ['0b'], displayFormat: 'binary' },
		{ args: ['&'], displayFormat: 'decimal', showAddress: true },
		{ args: ['end(*)'], displayFormat: 'decimal', dereference: true, showEndAddress: true },
		{ args: ['0x[2]'], displayFormat: 'hex', bufferPointer: 2 },
	])(
		'parses modifiers for an inline declaration: $args',
		({ args, displayFormat, showAddress = false, dereference = false, bufferPointer = 0, showEndAddress = false }) => {
			expect(createWatchDirectiveData(args, 4)).toEqual({
				lineNumber: 4,
				displayFormat,
				showEndAddress,
				inlineAccess: { showAddress, dereference, bufferPointer },
			});
		}
	);
});
