import { describe, expect, it } from 'vitest';
import getCodeBlockTypeFromSource from './getCodeBlockTypeFromSource';

describe('getCodeBlockTypeFromSource', () => {
	it('detects module blocks', () => {
		expect(getCodeBlockTypeFromSource(['module foo', 'moduleEnd'])).toBe('module');
	});

	it('detects function blocks', () => {
		expect(getCodeBlockTypeFromSource(['function foo', 'functionEnd'])).toBe('function');
	});

	it('detects constants blocks', () => {
		expect(getCodeBlockTypeFromSource(['constants', 'constantsEnd'])).toBe('constants');
	});

	it('detects note blocks', () => {
		expect(getCodeBlockTypeFromSource(['note', '; @pos 10 12', 'some text', 'noteEnd'])).toBe('note');
	});

	it('detects includes blocks', () => {
		expect(getCodeBlockTypeFromSource(['includes', 'include std/events/risingEdge', 'includesEnd'])).toBe('includes');
	});

	it('returns unknown for mixed markers', () => {
		expect(getCodeBlockTypeFromSource(['module foo', 'functionEnd', 'moduleEnd'])).toBe('unknown');
	});

	it('returns unknown for mixed note and module markers', () => {
		expect(getCodeBlockTypeFromSource(['module foo', 'noteEnd'])).toBe('unknown');
	});
});
