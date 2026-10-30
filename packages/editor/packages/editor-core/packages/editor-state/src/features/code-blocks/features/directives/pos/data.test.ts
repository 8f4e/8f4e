import { describe, expect, it } from 'vitest';
import { parseBlockDirectives } from '../../../utils/parseBlockDirectives';
import parsePos from './data';

describe('parsePos', () => {
	function runParsePos(code: string[]) {
		return parsePos(parseBlockDirectives(code));
	}

	it('parses valid @pos directive with positive integers', () => {
		const code = ['module test', '; @pos 10 20', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toEqual({ x: 10, y: 20 });
	});

	it('parses valid @pos directive with negative integers', () => {
		const code = ['module test', '; @pos -5 -10', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toEqual({ x: -5, y: -10 });
	});

	it('parses valid @pos directive with mixed sign integers', () => {
		const code = ['module test', '; @pos -5 10', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toEqual({ x: -5, y: 10 });
	});

	it('parses @pos directive with zero coordinates', () => {
		const code = ['module test', '; @pos 0 0', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toEqual({ x: 0, y: 0 });
	});

	it('returns undefined when no @pos directive exists', () => {
		const code = ['module test', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toBeUndefined();
	});

	it('returns undefined when @pos has no arguments', () => {
		const code = ['module test', '; @pos', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toBeUndefined();
	});

	it('returns undefined when @pos has only one argument', () => {
		const code = ['module test', '; @pos 10', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toBeUndefined();
	});

	it('returns undefined when @pos has more than two arguments', () => {
		const code = ['module test', '; @pos 10 20 30', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toBeUndefined();
	});

	it('returns undefined when x is not an integer', () => {
		const code = ['module test', '; @pos abc 20', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toBeUndefined();
	});

	it('returns undefined when y is not an integer', () => {
		const code = ['module test', '; @pos 10 abc', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toBeUndefined();
	});

	it('returns undefined when x is a float', () => {
		const code = ['module test', '; @pos 10.5 20', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toBeUndefined();
	});

	it('returns undefined when y is a float', () => {
		const code = ['module test', '; @pos 10 20.5', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toBeUndefined();
	});

	it('returns undefined when both are floats', () => {
		const code = ['module test', '; @pos 10.5 20.5', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toBeUndefined();
	});

	it('returns undefined when multiple @pos directives exist', () => {
		const code = ['module test', '; @pos 10 20', '; @pos 30 40', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toBeUndefined();
	});

	it('ignores other directives and only parses @pos', () => {
		const code = ['module test', '; @group myGroup', '; @pos 10 20', '; @marker', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toEqual({ x: 10, y: 20 });
	});

	it('handles @pos directive with extra whitespace', () => {
		const code = ['module test', ';   @pos   10   20  ', 'moduleEnd'];
		const result = runParsePos(code);
		expect(result).toEqual({ x: 10, y: 20 });
	});
});
