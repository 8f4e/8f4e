import { createMockState } from '@8f4e/editor-state-testing';
import type { EditorDirectiveDefinition } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import { parseBlockDirectives } from '../../utils/parseBlockDirectives';
import { createDirectiveRegistry, deriveDirectiveState, directiveDefinitions } from './registry';
import { parseEditorDirectives } from './utils';
import { getVerticalSpaceAfterSourceLineRequests } from './verticalSpaceAfterSourceLine';

const contributedDirectives: EditorDirectiveDefinition[] = [
	{
		name: 'inlineDisplay',
		aliases: ['inline'],
		allowTrailingComment: true,
		apply: (_, draft) => {
			draft.layoutCallbacks.push({});
		},
	},
	{
		name: 'rowDisplay',
		apply: (directive, draft) => {
			draft.addVerticalSpaceAfterSourceLine({
				sourceLineIndex: directive.sourceLineIndex,
				heightInRows: Number(directive.args[0]),
			});
		},
	},
];
const definitions = [...directiveDefinitions, ...contributedDirectives];

describe('directive registry', () => {
	it('registers directives per instance and removes their parsing and vertical-space requests', () => {
		const first = createDirectiveRegistry();
		const second = createDirectiveRegistry();
		const unregister = first.register({
			name: 'customWidget',
			apply: (directive, draft) => {
				draft.addVerticalSpaceAfterSourceLine({
					sourceLineIndex: directive.sourceLineIndex,
					heightInRows: Number(directive.args[0]),
				});
			},
		});
		const code = ['; @customWidget 2'];
		const records = parseBlockDirectives(code);
		expect(getVerticalSpaceAfterSourceLineRequests(deriveDirectiveState(code, records, {}, first.definitions))).toEqual(
			[{ sourceLineIndex: 0, heightInRows: 2 }]
		);
		expect(
			getVerticalSpaceAfterSourceLineRequests(deriveDirectiveState(code, records, {}, second.definitions))
		).toEqual([]);
		unregister();
		expect(getVerticalSpaceAfterSourceLineRequests(deriveDirectiveState(code, records, {}, first.definitions))).toEqual(
			[]
		);
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

	it('derives block state and contributed layout in a single pass', () => {
		const code = ['module foo', '; @disabled @home @favorite', '; @rowDisplay 3', 'moduleEnd'];
		const result = deriveDirectiveState(code, parseBlockDirectives(code), {}, definitions);
		expect(result.blockState).toEqual({ disabled: true, isHome: true, homeAlignment: 'center', isFavorite: true });
		expect(getVerticalSpaceAfterSourceLineRequests(result)).toEqual([{ sourceLineIndex: 2, heightInRows: 3 }]);
		expect(result.displayModel.displayRowToSourceLineIndex).toEqual([0, 1, 2, 3]);
	});

	it('allocates one info layout row per state.info key', () => {
		const code = ['module foo', '; @info foo', 'moduleEnd'];
		const result = deriveDirectiveState(code, parseBlockDirectives(code), {
			state: createMockState({
				info: {
					foo: {
						a: 1,
						bar: 'foo',
						foo: 'something longer',
					},
				},
			}),
		});

		expect(getVerticalSpaceAfterSourceLineRequests(result)).toEqual([{ sourceLineIndex: 1, heightInRows: 3 }]);
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
		expect(getVerticalSpaceAfterSourceLineRequests(result)).toEqual([]);
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
		expect(derived.layoutCallbacks).toHaveLength(1);
		expect(getVerticalSpaceAfterSourceLineRequests(derived)).toEqual([]);
	});
});
