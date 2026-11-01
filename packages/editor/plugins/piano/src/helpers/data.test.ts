import { describe, expect, it } from 'vitest';
import { createPianoDirectiveData } from './data';

describe('piano arguments', () => {
	it.each([
		{ args: ['&notes', '&count'], startingMidiNote: 0 },
		{ args: ['&notes', '&count', '48'], startingMidiNote: 48 },
		{ args: ['&group:notes', '&other:count', '60'], startingMidiNote: 60 },
	])('reads note addresses and starting note from $args', ({ args, startingMidiNote }) => {
		expect(createPianoDirectiveData(args, 7)).toEqual({
			sourceLineIndex: 7,
			pressedKeysListMemoryId: args[0],
			pressedKeyCountMemoryId: args[1],
			startingMidiNote,
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
