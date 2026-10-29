import { describe, expect, it } from 'vitest';
import { parseBlockDirectives } from '../../code-blocks/utils/parseBlockDirectives';
import { resolveGlobalEditorDirectives } from '../registry';

function block(code: string[], creationIndex = 0) {
	return { projectPath: '', creationIndex, parsedDirectives: parseBlockDirectives(code) };
}

describe('@mode directive', () => {
	it.each(['edit', 'view'] as const)('accepts %s in standalone and trailing comments', mode => {
		for (const code of [
			[`module test ; @mode ${mode}`, 'moduleEnd'],
			['note mode', `; @mode ${mode}`, 'noteEnd'],
		]) {
			const result = resolveGlobalEditorDirectives([block(code)]);
			expect(result.resolved.mode).toBe(mode);
			expect(result.errors).toEqual([]);
		}
	});

	it.each(['', 'other', 'EDIT', 'edit view'])('reports invalid arguments: %s', args => {
		const result = resolveGlobalEditorDirectives([block(['note mode', `; @mode ${args}`, 'noteEnd'], 8)]);
		expect(result.resolved.mode).toBeUndefined();
		expect(result.errors).toEqual([
			{ codeBlockId: 8, lineNumber: 1, message: '@mode requires exactly 1 argument: edit or view' },
		]);
	});

	it.each(['edit', 'view', 'invalid'])('invalidates duplicates across blocks after %s', first => {
		const result = resolveGlobalEditorDirectives([
			block(['note first', `; @mode ${first}`, 'noteEnd']),
			block(['note second', '; @mode edit', '; @mode view', 'noteEnd'], 12),
		]);
		expect(result.resolved.mode).toBeUndefined();
		expect(result.errors.filter(error => error.codeBlockId === 12)).toEqual([
			{ codeBlockId: 12, lineNumber: 1, message: '@mode may be declared only once per project' },
			{ codeBlockId: 12, lineNumber: 2, message: '@mode may be declared only once per project' },
		]);
	});
});
