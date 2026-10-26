import { createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import { parseBlockDirectives } from '../../utils/parseBlockDirectives';
import { createDirectiveRegistry, deriveDirectiveState, directiveDefinitions } from './registry';
import { parseEditorDirectives } from './utils';

describe('directive registry', () => {
	it('registers directives per instance and removes their parsing and layout contributions', () => {
		const first = createDirectiveRegistry();
		const second = createDirectiveRegistry();
		const unregister = first.register({
			name: 'customWidget',
			apply: (directive, draft) => {
				draft.layoutContributions.push({ rawRow: directive.rawRow, rows: Number(directive.args[0]) });
			},
		});
		const code = ['; @customWidget 2'];
		const records = parseBlockDirectives(code);
		expect(deriveDirectiveState(code, records, {}, first.definitions).layoutContributions).toEqual([
			{ rawRow: 0, rows: 2 },
		]);
		expect(deriveDirectiveState(code, records, {}, second.definitions).layoutContributions).toEqual([]);
		unregister();
		expect(deriveDirectiveState(code, records, {}, first.definitions).layoutContributions).toEqual([]);
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
				rawRow: 1,
				args: ['&buffer', 'count(buffer)'],
				sourceLine: '; @plot &buffer count(buffer)',
			},
			{
				name: 'bars',
				rawRow: 2,
				args: ['&bins', 'count(bins)'],
				sourceLine: '; @bars &bins count(bins)',
			},
			{
				name: 'slider',
				rawRow: 3,
				args: ['&gain', '0', '1', '0.01'],
				sourceLine: '; @slider &gain 0 1 0.01',
			},
			{
				name: 'crossfade',
				rawRow: 4,
				args: ['&dry', '&wet'],
				sourceLine: '; @crossfade &dry &wet',
			},
			{
				name: 'info',
				rawRow: 5,
				args: ['foo'],
				sourceLine: '; @info foo',
			},
			{
				name: 'stack',
				rawRow: 6,
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
			{ name: 'watch', rawRow: 0, args: [], sourceLine: 'int foo 1 ; @watch' },
			{ name: 'stack', rawRow: 1, args: [], sourceLine: 'push 1 ; @stack' },
			{ name: 'meter', rawRow: 2, args: [], sourceLine: 'float out ; @meter' },
		]);
	});

	it('parses chained directives from a single full-line comment', () => {
		const result = parseEditorDirectives(['; @home @favorite'], directiveDefinitions);

		expect(result).toEqual([
			{ name: 'home', rawRow: 0, args: [], sourceLine: '; @home @favorite' },
			{ name: 'favorite', rawRow: 0, args: [], sourceLine: '; @home @favorite' },
		]);
	});

	it('normalizes definition aliases during parsing', () => {
		const result = parseEditorDirectives(['; @w value', 'push 1 ; @s'], directiveDefinitions);

		expect(result).toEqual([
			{ name: 'watch', rawRow: 0, args: ['value'], sourceLine: '; @w value' },
			{ name: 'stack', rawRow: 1, args: [], sourceLine: 'push 1 ; @s' },
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
		expect(result.layoutContributions).toEqual([
			{ rawRow: 4, rows: 1 },
			{ rawRow: 5, rows: 8 },
			{ rawRow: 6, rows: 8 },
			{ rawRow: 7, rows: 2 },
		]);
		expect(result.displayState).toEqual({});
		expect(result.displayModel.displayRowToRawRow).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
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

		expect(result.layoutContributions).toEqual([{ rawRow: 1, rows: 3 }]);
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
		expect(result.layoutContributions).toEqual([{ rawRow: 2, rows: 8 }]);
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

		expect(result.displayState).toEqual({ hideAfterRawRow: 1 });
		expect(result.displayModel.displayRowToRawRow).toEqual([0, 1, 1]);
		expect(result.displayModel.lines[2]).toEqual({ rawRow: 1, text: '...', isPlaceholder: true });
		expect(result.displayModel.isCollapsed).toBe(true);
	});

	it('expands hidden code while editing', () => {
		const code = ['module foo', '; @hide', 'push 1', 'moduleEnd'];
		const result = deriveDirectiveState(code, parseBlockDirectives(code), {
			isExpandedForEditing: true,
		});

		expect(result.displayModel.displayRowToRawRow).toEqual([0, 1, 2, 3]);
		expect(result.displayModel.isCollapsed).toBe(false);
	});

	it('deriveDirectiveState and parseEditorDirectives agree on trailing directive behavior', () => {
		// @watch allows trailing comments; @plot does not.
		const code = ['int foo 1 ; @watch', 'int bar 1 ; @plot buffer'];
		const fromParse = parseEditorDirectives(code, directiveDefinitions);
		const fromDerive = deriveDirectiveState(code, parseBlockDirectives(code));

		// Both flows must recognize the trailing @watch (results in one parsed directive / one widget).
		expect(fromParse.map(d => d.name)).toEqual(['watch']);
		// @plot trailing should not produce any layout contribution.
		expect(fromDerive.layoutContributions).toEqual([]);
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
