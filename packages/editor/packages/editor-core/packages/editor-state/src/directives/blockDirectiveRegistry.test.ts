import type { EditorDirectiveDefinition } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import { createDirectiveRegistry, deriveDirectiveFacts, directiveDefinitions } from './blockDirectiveRegistry';
import { parseBlockDirectives } from './parseBlockDirectives';

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
		expect(deriveDirectiveFacts(code, records, first.definitions).blockState.disabled).toBe(true);
		expect(deriveDirectiveFacts(code, records, second.definitions).blockState.disabled).toBe(false);
		unregister();
		expect(deriveDirectiveFacts(code, records, first.definitions).blockState.disabled).toBe(false);
	});

	it('derives block and display facts', () => {
		const code = ['module foo', '; @disabled @testDirective', '; @rowDisplay 3', 'moduleEnd'];
		const result = deriveDirectiveFacts(code, parseBlockDirectives(code), definitions);
		expect(result.blockState).toEqual({ disabled: true, alwaysOnTop: false });
		expect(result.displayState).toEqual({});
	});

	it('ignores unregistered directives', () => {
		const code = ['; @unknown', '; @unregistered'];
		const result = deriveDirectiveFacts(code, parseBlockDirectives(code));

		expect(result.blockState).toEqual({ disabled: false, alwaysOnTop: false });
	});

	it('derives the authored fold location', () => {
		const code = ['module foo', '; @hide', 'push 1', 'moduleEnd'];
		const result = deriveDirectiveFacts(code, parseBlockDirectives(code));

		expect(result.displayState).toEqual({ hideAfterSourceLineIndex: 1 });
	});

	it('applies standalone and trailing directives and aliases uniformly', () => {
		const code = ['; @inline', 'int other 1 ; @rowDisplay 3 @testDirective'];
		const derived = deriveDirectiveFacts(code, parseBlockDirectives(code), definitions);
		expect(derived.blockState.alwaysOnTop).toBe(true);
		expect(derived.blockState.disabled).toBe(true);
	});
});
