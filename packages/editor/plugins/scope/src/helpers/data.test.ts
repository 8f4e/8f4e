import { parseBlockDirectives } from '@8f4e/editor-state';
import { describe, expect, it } from 'vitest';
import { createScopeDirectiveReader, interpretScopeDirective } from './data';

describe('scope directive data', () => {
	it.each([
		{ args: ['level', '30'], sampleRate: 30 },
		{ args: ['&level', '0.5'], sampleRate: 0.5 },
		{ args: ['group/module:level', '250', '-1', '1'], sampleRate: 250, minValueOverride: -1, maxValueOverride: 1 },
		{ args: ['*pointer', '10', '0', '255'], sampleRate: 10, minValueOverride: 0, maxValueOverride: 255 },
	])('interprets $args', ({ args, ...values }) => {
		expect(interpretScopeDirective(args, 3)).toEqual({
			kind: 'scope',
			data: { memoryId: args[0], lineNumber: 3, ...values },
		});
	});

	it.each([
		[],
		['level'],
		['level', 'memoryRate'],
		['level', '0'],
		['level', '-10'],
		['level', 'Infinity'],
		['level', '1e-9'],
		['level', '30', '0'],
		['level', '30', '1', '-1'],
		['level', '30', '0', '0'],
		['level', '30', '-1e308', '1e308'],
		['level', '30', 'NaN', '1'],
		['level', '30', '0', '1', '2'],
		['&', '30'],
	])('rejects invalid arguments %j', (...args: string[]) => {
		expect(interpretScopeDirective(args, 0)).toBeUndefined();
	});

	it.each(['250.1', '251', '1000', '1001'])('reports an over-limit diagnostic for %s Hz', rate => {
		expect(interpretScopeDirective(['level', rate], 4)).toEqual({
			kind: 'error',
			diagnostic: { lineNumber: 4, message: '@scope: sample rate must not exceed 250 Hz.' },
		});
	});

	it('reuses interpreted settings and diagnostics until the cached source directives change', () => {
		const read = createScopeDirectiveReader();
		const directives = parseBlockDirectives(['; @scope first 30 @scope second 500', '; @plot &buffer 4']);
		const result = read(directives);
		expect(result).toEqual({
			scopes: [{ memoryId: 'first', lineNumber: 0, sampleRate: 30 }],
			diagnostics: [{ lineNumber: 0, message: '@scope: sample rate must not exceed 250 Hz.' }],
		});
		expect(read(directives)).toBe(result);

		const edited = parseBlockDirectives(['; @scope first 30 @scope second 250']);
		const next = read(edited);
		expect(next).not.toBe(result);
		expect(next.scopes.map(scope => scope.sampleRate)).toEqual([30, 250]);
		expect(next.diagnostics).toEqual([]);
		expect(read(edited)).toBe(next);
	});
});
