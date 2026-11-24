import { describe, expect, it } from 'vitest';
import getBlockType from './getCodeBlockTypeFromSource';

describe('getBlockType', () => {
	it('detects module blocks', () => {
		expect(getBlockType(['module foo', 'moduleEnd'])).toBe('module');
	});

	it('detects function blocks', () => {
		expect(getBlockType(['function foo', 'functionEnd'])).toBe('function');
	});

	it('detects constants blocks', () => {
		expect(getBlockType(['constants', 'constantsEnd'])).toBe('constants');
	});

	it('detects note blocks', () => {
		expect(getBlockType(['note', '; @pos 10 12', 'some text', 'noteEnd'])).toBe('note');
	});

	it('detects includes blocks', () => {
		expect(getBlockType(['includes', 'include std/events/risingEdge', 'includesEnd'])).toBe('includes');
	});

	it('returns unknown for mixed markers', () => {
		expect(getBlockType(['module foo', 'functionEnd', 'moduleEnd'])).toBe('unknown');
	});

	it('returns unknown for mixed note and module markers', () => {
		expect(getBlockType(['module foo', 'noteEnd'])).toBe('unknown');
	});
});
