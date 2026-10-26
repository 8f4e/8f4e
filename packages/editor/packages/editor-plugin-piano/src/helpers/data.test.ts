import { describe, expect, it } from 'vitest';
import { createPianoDirectiveData } from './data';

describe('piano arguments', () => {
	it.each([
		{ args: ['&notes', '&count'], startingNumber: 0 },
		{ args: ['&notes', '&count', '48'], startingNumber: 48 },
		{ args: ['&group:notes', '&other:count', '60'], startingNumber: 60 },
	])('reads note addresses and starting note from $args', ({ args, startingNumber }) => {
		expect(createPianoDirectiveData(args, 7)).toEqual({
			sourceLineIndex: 7,
			pressedKeysListMemoryId: args[0],
			pressedNumberOfKeysMemoryId: args[1],
			startingNumber,
		});
	});
	it.each([
		[],
		['&notes'],
		['notes', '&count'],
		['&notes', 'count'],
		['&notes', '&count', '-1'],
		['&notes', '&count', '60.5'],
		['&notes', '&count', 'invalid'],
		['&notes', '&count', '48', 'extra'],
	])('rejects invalid arguments %j', (...args) => {
		expect(createPianoDirectiveData(args, 0)).toBeUndefined();
	});
});
