import { createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import { parseBlockDirectives } from '../../utils/parseBlockDirectives';
import { createDirectiveRegistry, deriveDirectiveState, directiveDefinitions } from './registry';
import { parseEditorDirectives } from './utils';
import { getVerticalSpaceAfterSourceLineRequests } from './verticalSpaceAfterSourceLine';

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

	it('parses registered directives from code', () => {
		const result = parseEditorDirectives(
			[
				'module foo',
				'; @plot &buffer count(buffer)',
				'; @bars &bins count(bins)',
				'; @slider &gain 0 1 0.01',
				'; @crossfade &dry &wet',
				'; @info foo',
				'; @stack',
				'; note',
				'moduleEnd',
			],
			directiveDefinitions
		);

		expect(result).toEqual([
			{
				name: 'plot',
				sourceLineIndex: 1,
				args: ['&buffer', 'count(buffer)'],
				sourceLine: '; @plot &buffer count(buffer)',
			},
			{
				name: 'bars',
				sourceLineIndex: 2,
				args: ['&bins', 'count(bins)'],
				sourceLine: '; @bars &bins count(bins)',
			},
			{
				name: 'slider',
				sourceLineIndex: 3,
				args: ['&gain', '0', '1', '0.01'],
				sourceLine: '; @slider &gain 0 1 0.01',
			},
			{
				name: 'crossfade',
				sourceLineIndex: 4,
				args: ['&dry', '&wet'],
				sourceLine: '; @crossfade &dry &wet',
			},
			{
				name: 'info',
				sourceLineIndex: 5,
				args: ['foo'],
				sourceLine: '; @info foo',
			},
			{
				name: 'stack',
				sourceLineIndex: 6,
				args: [],
				sourceLine: '; @stack',
			},
		]);
	});

	it('parses trailing-comment directives only for definitions that allow them', () => {
		const result = parseEditorDirectives(
			['int foo 1 ; @watch', 'push 1 ; @stack', 'float out ; @meter', 'int bar 1 ; @plot buffer'],
			directiveDefinitions
		);

		expect(result).toEqual([
			{ name: 'watch', sourceLineIndex: 0, args: [], sourceLine: 'int foo 1 ; @watch' },
			{ name: 'stack', sourceLineIndex: 1, args: [], sourceLine: 'push 1 ; @stack' },
			{ name: 'meter', sourceLineIndex: 2, args: [], sourceLine: 'float out ; @meter' },
		]);
	});

	it('parses chained directives from a single full-line comment', () => {
		const result = parseEditorDirectives(['; @home @favorite'], directiveDefinitions);

		expect(result).toEqual([
			{ name: 'home', sourceLineIndex: 0, args: [], sourceLine: '; @home @favorite' },
			{ name: 'favorite', sourceLineIndex: 0, args: [], sourceLine: '; @home @favorite' },
		]);
	});

	it('normalizes definition aliases during parsing', () => {
		const result = parseEditorDirectives(['; @w value', 'push 1 ; @s'], directiveDefinitions);

		expect(result).toEqual([
			{ name: 'watch', sourceLineIndex: 0, args: ['value'], sourceLine: '; @w value' },
			{ name: 'stack', sourceLineIndex: 1, args: [], sourceLine: 'push 1 ; @s' },
		]);
	});

	it('derives block state and layout in a single pass', () => {
		const code = [
			'module foo',
			'; @disabled',
			'; @home',
			'; @favorite',
			'; @meter level 0 1',
			'; @plot &buffer count(buffer)',
			'; @bars &bins count(bins)',
			'; @crossfade &dry &wet',
			'moduleEnd',
		];
		const result = deriveDirectiveState(code, parseBlockDirectives(code));

		expect(result.blockState).toEqual({
			disabled: true,
			isHome: true,
			homeAlignment: 'center',
			isFavorite: true,
		});
		expect(getVerticalSpaceAfterSourceLineRequests(result)).toEqual([
			{ sourceLineIndex: 4, heightInRows: 1 },
			{ sourceLineIndex: 5, heightInRows: 8 },
			{ sourceLineIndex: 6, heightInRows: 8 },
			{ sourceLineIndex: 7, heightInRows: 2 },
		]);
		expect(result.displayState).toEqual({});
		expect(result.displayModel.displayRowToSourceLineIndex).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
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
		const code = ['; @unknown', '; @home', '; @plot &buffer count(buffer)'];
		const result = deriveDirectiveState(code, parseBlockDirectives(code));

		expect(result.blockState).toEqual({
			disabled: false,
			isHome: true,
			homeAlignment: 'center',
			isFavorite: false,
		});
		expect(getVerticalSpaceAfterSourceLineRequests(result)).toEqual([{ sourceLineIndex: 2, heightInRows: 8 }]);
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

	it('deriveDirectiveState and parseEditorDirectives agree on trailing directive behavior', () => {
		// @watch allows trailing comments; @plot does not.
		const code = ['int foo 1 ; @watch', 'int bar 1 ; @plot buffer'];
		const fromParse = parseEditorDirectives(code, directiveDefinitions);
		const fromDerive = deriveDirectiveState(code, parseBlockDirectives(code));

		// Both flows must recognize the trailing @watch (results in one parsed directive / one widget).
		expect(fromParse.map(d => d.name)).toEqual(['watch']);
		// @plot trailing should not produce any extra vertical space.
		expect(getVerticalSpaceAfterSourceLineRequests(fromDerive)).toEqual([]);
	});

	it('normalizes aliases in deriveDirectiveState the same way as parseEditorDirectives', () => {
		const code = ['; @w value'];
		const fromParse = parseEditorDirectives(code, directiveDefinitions);
		const fromDerive = deriveDirectiveState(code, parseBlockDirectives(code));

		// Both paths normalize '@w' to the canonical 'watch' name.
		expect(fromParse[0].name).toBe('watch');
		// @watch with a valid arg produces one widget.
		expect(fromDerive.layoutCallbacks).toHaveLength(1);
	});
});
