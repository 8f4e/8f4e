import type { EditorDirectiveDefinition } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import { parseBlockDirectives } from '../../utils/parseBlockDirectives';
import { createDirectiveRegistry, deriveDirectiveState, directiveDefinitions } from './registry';

const contributedDirectives: EditorDirectiveDefinition[] = [
	{
		name: 'inlineDisplay',
		aliases: ['inline'],
		apply: (_, draft) => {
			draft.blockState.alwaysOnTop = true;
		},
	},
	{
		name: 'rowDisplay',
		apply: (directive, draft) => {
			draft.blockState.disabled = true;
		},
	},
];
const definitions = [...directiveDefinitions, ...contributedDirectives];

describe('directive registry', () => {
	it('registers directive behavior per instance and removes it', () => {
		const first = createDirectiveRegistry();
		const second = createDirectiveRegistry();
		const unregister = first.register({
			name: 'customFlag',
			apply: (_, draft) => {
				draft.blockState.disabled = true;
			},
		});
		const code = ['; @customFlag'];
		const records = parseBlockDirectives(code);
		expect(deriveDirectiveState(code, records, {}, first.definitions).blockState.disabled).toBe(true);
		expect(deriveDirectiveState(code, records, {}, second.definitions).blockState.disabled).toBe(false);
		unregister();
		expect(deriveDirectiveState(code, records, {}, first.definitions).blockState.disabled).toBe(false);
	});

	it('derives block state and display rows', () => {
		const code = ['module foo', '; @disabled @testDirective', '; @rowDisplay 3', 'moduleEnd'];
		const result = deriveDirectiveState(code, parseBlockDirectives(code), {}, definitions);
		expect(result.blockState).toEqual({ disabled: true });
		expect(result.displayModel.displayRowToSourceLineIndex).toEqual([0, 1, 2, 3]);
	});

	it('ignores unregistered directives', () => {
		const code = ['; @unknown', '; @unregistered'];
		const result = deriveDirectiveState(code, parseBlockDirectives(code));

		expect(result.blockState).toEqual({ disabled: false });
	});

	it('collapses everything after @hide while unselected', () => {
		const code = ['module foo', '; @hide', 'push 1', 'moduleEnd'];
		const result = deriveDirectiveState(code, parseBlockDirectives(code));

		expect(result.displayState).toEqual({ hideAfterSourceLineIndex: 1 });
		expect(result.displayModel.displayRowToSourceLineIndex).toEqual([0, 1, 1]);
		expect(result.displayModel.lines[2]).toEqual({ sourceLineIndex: 1, text: '...', isPlaceholder: true });
		expect(result.displayModel.isCollapsed).toBe(true);
	});

	it('expands hidden code while editing', () => {
		const code = ['module foo', '; @hide', 'push 1', 'moduleEnd'];
		const result = deriveDirectiveState(code, parseBlockDirectives(code), {
			isExpandedForEditing: true,
		});

		expect(result.displayModel.displayRowToSourceLineIndex).toEqual([0, 1, 2, 3]);
		expect(result.displayModel.isCollapsed).toBe(false);
	});

	it('applies standalone and trailing directives and aliases uniformly', () => {
		const code = ['; @inline', 'int other 1 ; @rowDisplay 3 @testDirective'];
		const derived = deriveDirectiveState(code, parseBlockDirectives(code), {}, definitions);
		expect(derived.blockState.alwaysOnTop).toBe(true);
		expect(derived.blockState.disabled).toBe(true);
	});
});
