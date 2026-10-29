import { describe, expect, it } from 'vitest';
import getCodeBlockNameFromSource from './getCodeBlockNameFromSource';

describe('getCodeBlockNameFromSource', () => {
	it('returns raw module names for module blocks', () => {
		expect(getCodeBlockNameFromSource(['module testModule', '', 'moduleEnd'])).toBe('testModule');
	});

	it('returns raw function names for function blocks', () => {
		expect(getCodeBlockNameFromSource(['function testFunction', '', 'functionEnd'])).toBe('testFunction');
	});

	it('returns raw constants names for constants blocks', () => {
		expect(getCodeBlockNameFromSource(['constants env', '', 'constantsEnd'])).toBe('env');
	});

	it('returns raw prototype names for prototype blocks', () => {
		expect(getCodeBlockNameFromSource(['prototype oscillatorState', '', 'prototypeEnd'])).toBe('oscillatorState');
	});

	it('returns raw project-group names for group blocks', () => {
		expect(getCodeBlockNameFromSource(['group audio', '', 'groupEnd'])).toBe('audio');
	});

	it('returns source names for notes and includes, and an empty name for unnamed blocks', () => {
		expect(getCodeBlockNameFromSource(['note', 'module bodyText', 'noteEnd'])).toBe('');
		expect(getCodeBlockNameFromSource(['note colors', '', 'noteEnd'])).toBe('colors');
		expect(getCodeBlockNameFromSource(['includes utilities', '', 'includesEnd'])).toBe('utilities');
	});

	it('returns empty string when no block name is found', () => {
		expect(getCodeBlockNameFromSource(['some random code', 'without markers'])).toBe('');
	});

	it('ignores trailing comments after names', () => {
		expect(getCodeBlockNameFromSource(['module testModule ; comment', '', 'moduleEnd'])).toBe('testModule');
	});
});
