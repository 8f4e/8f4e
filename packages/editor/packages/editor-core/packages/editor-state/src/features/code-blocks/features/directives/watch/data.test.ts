import { describe, expect, it } from 'vitest';
import { parseEditorDirectives } from '../utils';
import { createWatchDirectiveData } from './data';
import watchDirective from './plugin';

function parseWatchDirectiveData(code: string[]) {
	return parseEditorDirectives(code, [watchDirective])
		.map(directive => createWatchDirectiveData(directive.args, directive.sourceLineIndex, directive.sourceLine))
		.filter(result => result !== undefined);
}

describe('watch directive data', () => {
	it('should parse debug instruction with id', () => {
		const code = ['; @watch myVar'];
		const result = parseWatchDirectiveData(code);

		expect(result).toEqual([
			{
				id: 'myVar',
				lineNumber: 0,
			},
		]);
	});

	it('should parse shorthand watch directives', () => {
		const code = ['; @w myVar'];
		const result = parseWatchDirectiveData(code);

		expect(result).toEqual([
			{
				id: 'myVar',
				lineNumber: 0,
			},
		]);
	});

	it('should handle multiple debug instructions', () => {
		const code = ['; @watch var1', 'mov a b', '; @watch var2', 'add c d', '; @watch var3'];
		const result = parseWatchDirectiveData(code);

		expect(result).toEqual([
			{
				id: 'var1',
				lineNumber: 0,
			},
			{
				id: 'var2',
				lineNumber: 2,
			},
			{
				id: 'var3',
				lineNumber: 4,
			},
		]);
	});

	it('should return empty array when no debug instructions found', () => {
		const code = ['mov a b', 'add c d', 'sub e f'];
		const result = parseWatchDirectiveData(code);

		expect(result).toEqual([]);
	});

	it('should handle empty code array', () => {
		const code: string[] = [];
		const result = parseWatchDirectiveData(code);

		expect(result).toEqual([]);
	});

	it('should preserve correct line numbers', () => {
		const code = ['nop', 'nop', '; @watch var1', 'nop', 'nop', '; @watch var2'];
		const result = parseWatchDirectiveData(code);

		expect(result).toEqual([
			{
				id: 'var1',
				lineNumber: 2,
			},
			{
				id: 'var2',
				lineNumber: 5,
			},
		]);
	});

	it('should ignore malformed watch directives without an id', () => {
		expect(parseWatchDirectiveData(['; @watch'])).toEqual([]);
	});

	it('should infer the watched memory id from a same-line declaration', () => {
		expect(parseWatchDirectiveData(['int foo 1 ; @watch'])).toEqual([
			{
				id: 'foo',
				lineNumber: 0,
			},
		]);
	});

	it('should infer the watched memory id from a same-line shorthand directive', () => {
		expect(parseWatchDirectiveData(['int foo 1 ; @w'])).toEqual([
			{
				id: 'foo',
				lineNumber: 0,
			},
		]);
	});

	it('should prefer an explicit watch id over same-line inference', () => {
		expect(parseWatchDirectiveData(['int foo 1 ; @watch bar'])).toEqual([
			{
				id: 'bar',
				lineNumber: 0,
			},
		]);
	});

	it('should apply hex formatting to an inferred same-line watch id', () => {
		expect(parseWatchDirectiveData(['int foo 1 ; @watch 0x'])).toEqual([
			{
				id: '0xfoo',
				lineNumber: 0,
			},
		]);
	});

	it('should apply binary formatting to an inferred same-line watch id', () => {
		expect(parseWatchDirectiveData(['int foo 1 ; @watch 0b'])).toEqual([
			{
				id: '0bfoo',
				lineNumber: 0,
			},
		]);
	});

	it('should preserve explicit hex watch ids instead of treating them as templates', () => {
		expect(parseWatchDirectiveData(['int foo 1 ; @watch 0xbar'])).toEqual([
			{
				id: '0xbar',
				lineNumber: 0,
			},
		]);
	});

	it('should infer compiler-generated ids for inline anonymous declarations', () => {
		expect(parseWatchDirectiveData(['int 1 ; @watch'])).toEqual([
			{
				id: '__anonymous__0',
				lineNumber: 0,
			},
		]);
	});

	it('should infer compiler-generated ids for same-line anonymous declarations', () => {
		expect(parseWatchDirectiveData(['int 0 ; @watch'])).toEqual([
			{
				id: '__anonymous__0',
				lineNumber: 0,
			},
		]);
	});

	it('should apply formatting templates to inferred anonymous declaration ids', () => {
		expect(parseWatchDirectiveData(['int 0 ; @watch 0x'])).toEqual([
			{
				id: '0x__anonymous__0',
				lineNumber: 0,
			},
		]);
	});

	it('should infer compiler-generated id for bare int declaration (no arguments)', () => {
		expect(parseWatchDirectiveData(['int ; @watch'])).toEqual([
			{
				id: '__anonymous__0',
				lineNumber: 0,
			},
		]);
	});

	it('should infer compiler-generated id for bare float declaration (no arguments)', () => {
		expect(parseWatchDirectiveData(['float ; @watch'])).toEqual([
			{
				id: '__anonymous__0',
				lineNumber: 0,
			},
		]);
	});

	it('should infer compiler-generated id for bare int* declaration (no arguments)', () => {
		expect(parseWatchDirectiveData(['int* ; @watch'])).toEqual([
			{
				id: '__anonymous__0',
				lineNumber: 0,
			},
		]);
	});

	it('should apply formatting templates to inferred bare anonymous declaration ids', () => {
		expect(parseWatchDirectiveData(['int ; @watch 0x'])).toEqual([
			{
				id: '0x__anonymous__0',
				lineNumber: 0,
			},
		]);
	});
});
