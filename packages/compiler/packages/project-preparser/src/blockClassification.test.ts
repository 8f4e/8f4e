import { describe, expect, it } from 'vitest';

import { getDocumentProjectBlockType, getProjectBlockType } from './blockClassification';

const validModuleBlock = ['module counter', '', 'int count', '', 'moduleEnd'];
const validFunctionBlock = ['function sine', 'param float x', 'functionEnd float'];
const validNoteBlock = ['note', '; @pos 2 3', 'remember to tune this later', 'noteEnd'];
const validIncludesBlock = ['includes', 'include std/events/risingEdge', 'includesEnd'];

describe('getDocumentProjectBlockType', () => {
	it('detects document block types from matching opener and closer markers', () => {
		expect(getDocumentProjectBlockType(validModuleBlock)).toBe('module');
		expect(getDocumentProjectBlockType(validFunctionBlock)).toBe('function');
		expect(getDocumentProjectBlockType(['constants', 'constantsEnd'])).toBe('constants');
		expect(getDocumentProjectBlockType(validNoteBlock)).toBe('note');
		expect(getDocumentProjectBlockType(validIncludesBlock)).toBe('includes');
	});

	it('returns unknown when a block has mixed or incomplete document markers', () => {
		expect(getDocumentProjectBlockType(['module foo', 'functionEnd', 'moduleEnd'])).toBe('unknown');
		expect(getDocumentProjectBlockType(['module foo'])).toBe('unknown');
		expect(getDocumentProjectBlockType(['moduleEnd'])).toBe('unknown');
	});
});

describe('getProjectBlockType', () => {
	it('detects compiler input block types from the first non-gap opener', () => {
		expect(getProjectBlockType(validModuleBlock)).toBe('module');
		expect(getProjectBlockType(validFunctionBlock)).toBe('function');
		expect(getProjectBlockType(['constants', 'constantsEnd'])).toBe('constants');
	});

	it('returns unknown for project blocks that are not compiler inputs', () => {
		expect(getProjectBlockType(validNoteBlock)).toBe('unknown');
		expect(getProjectBlockType(validIncludesBlock)).toBe('unknown');
	});
});
