import { matchEditorDirectives, parseBlockDirectives } from '@8f4e/editor-state';
import { describe, expect, it } from 'vitest';
import { createBarsDirectiveData } from './data';

function parseBarsDirectiveData(code: string[]) {
	return matchEditorDirectives(parseBlockDirectives(code), [{ name: 'bars' }]).map(directive =>
		createBarsDirectiveData(directive.args, directive.sourceLineIndex)
	);
}

describe('bars directive data', () => {
	it('parses bars instruction with explicit array length memory', () => {
		expect(parseBarsDirectiveData(['; @bars bins arrayLength'])).toEqual([
			{ startAddressMemoryId: 'bins', lineNumber: 0, length: 'arrayLength' },
		]);
	});

	it('rejects bars instruction without an explicit array length', () => {
		expect(parseBarsDirectiveData(['; @bars bins'])).toEqual([undefined]);
	});

	it('parses bars instruction with a literal element count', () => {
		expect(parseBarsDirectiveData(['; @bars bins 128'])).toEqual([
			{ startAddressMemoryId: 'bins', lineNumber: 0, length: 128 },
		]);
	});

	it('parses bars instruction with both length and range override', () => {
		expect(parseBarsDirectiveData(['; @bars bins 64 0 1'])).toEqual([
			{ startAddressMemoryId: 'bins', lineNumber: 0, length: 64, minValueOverride: 0, maxValueOverride: 1 },
		]);
	});

	it('rejects debugger expressions, incomplete ranges, and extra arguments', () => {
		expect(parseBarsDirectiveData(['; @bars *bins 64'])).toEqual([undefined]);
		expect(parseBarsDirectiveData(['; @bars bins 64 0'])).toEqual([undefined]);
		expect(parseBarsDirectiveData(['; @bars bins 64 0 1 extra'])).toEqual([undefined]);
	});
});
