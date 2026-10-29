import type { EditorDirectiveDefinition } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import { parseBlockDirectives } from '../../utils/parseBlockDirectives';
import { createDirectiveRegistry, deriveDirectiveState, directiveDefinitions } from './registry';
import { parseEditorDirectives } from './utils';

const contributedDirectives: EditorDirectiveDefinition[] = [
	{
		name: 'inlineDisplay',
		aliases: ['inline'],
		allowTrailingComment: true,
		apply: (_, draft) => {
			draft.blockState.isFavorite = true;
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

	it('parses registered directives and permits trailing comments only when enabled', () => {
		expect(
			parseEditorDirectives(
				['; @rowDisplay 2', 'int value 1 ; @inlineDisplay', 'int value 1 ; @rowDisplay 2'],
				definitions
			)
		).toEqual([
			{ name: 'rowDisplay', sourceLineIndex: 0, args: ['2'], sourceLine: '; @rowDisplay 2' },
			{ name: 'inlineDisplay', sourceLineIndex: 1, args: [], sourceLine: 'int value 1 ; @inlineDisplay' },
		]);
	});

	it('parses chained directives from a single full-line comment', () => {
		const result = parseEditorDirectives(['; @home @favorite'], directiveDefinitions);

		expect(result).toEqual([
			{ name: 'home', sourceLineIndex: 0, args: [], sourceLine: '; @home @favorite' },
			{ name: 'favorite', sourceLineIndex: 0, args: [], sourceLine: '; @home @favorite' },
		]);
	});

	it('derives block state and display rows', () => {
		const code = ['module foo', '; @disabled @home @favorite', '; @rowDisplay 3', 'moduleEnd'];
		const result = deriveDirectiveState(code, parseBlockDirectives(code), {}, definitions);
		expect(result.blockState).toEqual({ disabled: true, isHome: true, homeAlignment: 'center', isFavorite: true });
		expect(result.displayModel.displayRowToSourceLineIndex).toEqual([0, 1, 2, 3]);
	});

	it('ignores unregistered directives', () => {
		const code = ['; @unknown', '; @home', '; @unregistered'];
		const result = deriveDirectiveState(code, parseBlockDirectives(code));

		expect(result.blockState).toEqual({
			disabled: false,
			isHome: true,
			homeAlignment: 'center',
			isFavorite: false,
		});
	});

	it('derives optional home alignment from @home', () => {
		const code = ['module foo', '; @home bottom', 'moduleEnd'];
		const result = deriveDirectiveState(code, parseBlockDirectives(code));

		expect(result.blockState.isHome).toBe(true);
		expect(result.blockState.homeAlignment).toBe('bottom');
	});

	it('ignores invalid @home arguments', () => {
		const code = ['module foo', '; @home middle', 'moduleEnd'];
		const result = deriveDirectiveState(code, parseBlockDirectives(code));

		expect(result.blockState.isHome).toBe(false);
		expect(result.blockState.homeAlignment).toBeUndefined();
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

	it('normalizes aliases and trailing records consistently in parsing and derivation', () => {
		const code = ['int value 1 ; @inline', 'int other 1 ; @rowDisplay 3'];
		const parsed = parseEditorDirectives(code, definitions);
		const derived = deriveDirectiveState(code, parseBlockDirectives(code), {}, definitions);
		expect(parsed.map(directive => directive.name)).toEqual(['inlineDisplay']);
		expect(derived.blockState.isFavorite).toBe(true);
		expect(derived.blockState.disabled).toBe(false);
	});
});
