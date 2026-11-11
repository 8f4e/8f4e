import { describe, expect, it } from 'vitest';
import { createWatchDirectiveData } from './data';

describe('watch directive data', () => {
	it.each([
		{ expression: 'value', identifier: 'value', displayFormat: 'decimal' },
		{ expression: '0xvalue', identifier: 'value', displayFormat: 'hex' },
		{ expression: '0bvalue', identifier: 'value', displayFormat: 'binary' },
		{ expression: '0x*pointer', identifier: '*pointer', displayFormat: 'hex' },
		{ expression: '&buffer[2]', identifier: '&buffer[2]', displayFormat: 'decimal' },
	])('interprets presentation arguments for $expression', ({ expression, identifier, displayFormat }) => {
		expect(createWatchDirectiveData([expression], 3)).toEqual({
			lineNumber: 3,
			displayFormat,
			target: { kind: 'memory', identifier },
		});
	});

	it.each([
		['end(value)', 'decimal', { scope: 'local', targetKind: 'memory', targetMemoryId: 'value' }],
		['0bend(*pointer)', 'binary', { scope: 'local', targetKind: 'pointee', targetMemoryId: 'pointer' }],
		['end(source:)', 'decimal', { scope: 'intermodule', targetKind: 'module', targetModuleId: 'source' }],
	])('retains the parsed selector for %s', (expression, displayFormat, selector) => {
		expect(createWatchDirectiveData([expression], 3)).toMatchObject({
			lineNumber: 3,
			displayFormat,
			target: { kind: 'end', query: selector },
		});
	});

	it.each([
		{ args: [], displayFormat: 'decimal' },
		{ args: ['0x'], displayFormat: 'hex' },
		{ args: ['0b'], displayFormat: 'binary' },
		{ args: ['&'], displayFormat: 'decimal', showAddress: true },
		{ args: ['*'], displayFormat: 'decimal', dereference: true },
		{ args: ['0x[2]'], displayFormat: 'hex', bufferPointer: 2 },
	])(
		'parses modifiers for an inline declaration: $args',
		({ args, displayFormat, showAddress = false, dereference = false, bufferPointer = 0 }) => {
			expect(createWatchDirectiveData(args, 4)).toEqual({
				lineNumber: 4,
				displayFormat,
				target: { kind: 'inline', options: { showAddress, dereference, bufferPointer } },
			});
		}
	);

	it.each([
		['end()', false],
		['end(*)', true],
	] as const)('parses the inline boundary selector %s', (expression, dereference) => {
		expect(createWatchDirectiveData([expression], 4)).toEqual({
			lineNumber: 4,
			displayFormat: 'decimal',
			target: { kind: 'inline-end', dereference },
		});
	});

	it.each(['end(buffer', 'end(**pointer)', 'end(end(buffer))'])('ignores the malformed query %s', expression =>
		expect(createWatchDirectiveData([expression], 4)).toBeUndefined()
	);
});
