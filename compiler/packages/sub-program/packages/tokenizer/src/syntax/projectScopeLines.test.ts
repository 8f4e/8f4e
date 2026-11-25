import { describe, expect, it } from 'vitest';
import { classifyProjectScopeLine, isProjectGapLine } from './projectScopeLines';

describe('project scope source lines', () => {
	it.each(['', ' ', '# project comment', ' ; @pos 0 0', '\t// project comment'])(
		'preserves blank or comment line %j',
		line => {
			expect(isProjectGapLine(line)).toBe(true);
			expect(classifyProjectScopeLine(line)).toEqual({ kind: 'gap' });
		}
	);

	it.each([
		['expose output &child:value', 'expose'],
		['\tinit &output 1', 'init'],
		['pass; missing argument', 'pass'],
	])('classifies declarations without validating their arguments: %s', (line, instruction) => {
		expect(classifyProjectScopeLine(line)).toEqual({ kind: 'declaration', instruction });
	});

	it.each([
		['push 1', 'push'],
		['passage env', 'passage'],
		['module counter', 'module'],
		['group left use voice', 'group'],
		['groupEnd', 'groupEnd'],
	])('does not skip unsupported statements: %s', (line, instruction) => {
		expect(isProjectGapLine(line)).toBe(false);
		expect(classifyProjectScopeLine(line)).toEqual({ kind: 'unsupported', instruction });
	});
});
