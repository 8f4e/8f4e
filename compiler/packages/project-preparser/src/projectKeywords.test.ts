import { describe, expect, it } from 'vitest';

import {
	getExpectedProjectCloserPrefix,
	getProjectCloserKeyword,
	getProjectOpenerKeyword,
	startsWithInstruction,
} from './projectKeywords';

describe('startsWithInstruction', () => {
	it('matches exact instructions and instructions followed by whitespace', () => {
		expect(startsWithInstruction('module', 'module')).toBe(true);
		expect(startsWithInstruction('module counter', 'module')).toBe(true);
		expect(startsWithInstruction('module\tcounter', 'module')).toBe(true);
	});

	it('rejects prefix-only matches', () => {
		expect(startsWithInstruction('moduleEnd', 'module')).toBe(false);
		expect(startsWithInstruction('moduleCounter', 'module')).toBe(false);
	});
});

describe('getProjectOpenerKeyword', () => {
	it('detects document and project container openers', () => {
		expect(getProjectOpenerKeyword('module counter')).toBe('module');
		expect(getProjectOpenerKeyword('function sine')).toBe('function');
		expect(getProjectOpenerKeyword('entry main')).toBe('entry');
		expect(getProjectOpenerKeyword('group audio')).toBe('group');
		expect(getProjectOpenerKeyword('includes')).toBe('includes');
	});

	it('returns null for non-opener project lines', () => {
		expect(getProjectOpenerKeyword('moduleEnd')).toBeNull();
		expect(getProjectOpenerKeyword('push 1')).toBeNull();
	});
});

describe('getProjectCloserKeyword', () => {
	it('detects document and project container closers', () => {
		expect(getProjectCloserKeyword('moduleEnd')).toBe('moduleEnd');
		expect(getProjectCloserKeyword('functionEnd float')).toBe('functionEnd');
		expect(getProjectCloserKeyword('entryEnd')).toBe('entryEnd');
		expect(getProjectCloserKeyword('groupEnd')).toBe('groupEnd');
		expect(getProjectCloserKeyword('includesEnd')).toBe('includesEnd');
	});

	it('returns null for non-closer project lines', () => {
		expect(getProjectCloserKeyword('module counter')).toBeNull();
		expect(getProjectCloserKeyword('push 1')).toBeNull();
	});
});

describe('getExpectedProjectCloserPrefix', () => {
	it('returns the configured closer for known project openers', () => {
		expect(getExpectedProjectCloserPrefix('module')).toBe('moduleEnd');
		expect(getExpectedProjectCloserPrefix('entry')).toBe('entryEnd');
		expect(getExpectedProjectCloserPrefix('group')).toBe('groupEnd');
		expect(getExpectedProjectCloserPrefix('includes')).toBe('includesEnd');
	});

	it('falls back to the conventional End suffix for unknown openers', () => {
		expect(getExpectedProjectCloserPrefix('custom')).toBe('customEnd');
	});
});
