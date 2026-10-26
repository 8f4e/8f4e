import { describe, expect, it } from 'vitest';
import { parseEditorDirectives } from '../utils';
import { createPianoDirectiveData } from './data';
import pianoDirective from './plugin';

function parsePianoDirectiveData(code: string[]) {
	return parseEditorDirectives(code, [pianoDirective]).map(directive =>
		createPianoDirectiveData(directive.args, directive.sourceLineIndex)
	);
}

describe('piano directive data', () => {
	it('should parse piano instruction with all arguments', () => {
		const code = ['; @piano &keys1 &numKeys 60'];
		const result = parsePianoDirectiveData(code);

		expect(result).toEqual([
			{
				id: '&keys1',
				lineNumber: 0,
				pressedNumberOfKeysMemoryId: '&numKeys',
				pressedKeysListMemoryId: '&keys1',
				startingNumber: 60,
			},
		]);
	});

	it('should parse piano instruction with default starting number', () => {
		const code = ['; @piano &keys1 &numKeys'];
		const result = parsePianoDirectiveData(code);

		expect(result).toEqual([
			{
				id: '&keys1',
				lineNumber: 0,
				pressedNumberOfKeysMemoryId: '&numKeys',
				pressedKeysListMemoryId: '&keys1',
				startingNumber: 0,
			},
		]);
	});

	it('should handle multiple piano instructions', () => {
		const code = ['; @piano &keys1 &numKeys1 60', 'mov a b', '; @piano &keys2 &numKeys2 48'];
		const result = parsePianoDirectiveData(code);

		expect(result).toHaveLength(2);
		expect(result[0].id).toBe('&keys1');
		expect(result[0].lineNumber).toBe(0);
		expect(result[0].startingNumber).toBe(60);
		expect(result[1].id).toBe('&keys2');
		expect(result[1].lineNumber).toBe(2);
		expect(result[1].startingNumber).toBe(48);
	});

	it('should return empty array when no piano instructions found', () => {
		const code = ['mov a b', 'add c d', 'sub e f'];
		const result = parsePianoDirectiveData(code);

		expect(result).toEqual([]);
	});

	it('should handle empty code array', () => {
		const code: string[] = [];
		const result = parsePianoDirectiveData(code);

		expect(result).toEqual([]);
	});

	it('rejects plain memory targets', () => {
		expect(parsePianoDirectiveData(['; @piano keys &numKeys'])).toEqual([undefined]);
		expect(parsePianoDirectiveData(['; @piano &keys numKeys'])).toEqual([undefined]);
	});

	it('rejects a fractional starting number', () => {
		const code = ['; @piano &keys1 &numKeys 60.5'];
		const result = parsePianoDirectiveData(code);

		expect(result).toEqual([undefined]);
	});

	it('rejects an invalid starting number', () => {
		const code = ['; @piano &keys1 &numKeys invalid'];
		const result = parsePianoDirectiveData(code);

		expect(result).toEqual([undefined]);
	});

	it('should preserve correct line numbers', () => {
		const code = ['nop', 'nop', '; @piano &keys1 &numKeys 60', 'nop', 'nop', '; @piano &keys2 &numKeys2 48'];
		const result = parsePianoDirectiveData(code);

		expect(result[0].lineNumber).toBe(2);
		expect(result[1].lineNumber).toBe(5);
	});
});
