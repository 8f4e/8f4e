import { BASE_COLORS, resolvePalette } from '@8f4e/editor-palette';
import initState, { applyCodeBlockSourceEdits, EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { createMockEventDispatcher } from '@8f4e/editor-state-testing';
import type { EditorConfigEntry } from '@8f4e/editor-state-types';
import { DEFAULT_FONT, FONT_NAMES } from '@8f4e/sprite-generator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getConfiguredFont, getConfiguredPalette, registerWebUiConfig } from './config';

function entry(path: string, value: string): EditorConfigEntry {
	return { path, value, sourceLineIndex: 1, codeBlockId: 0 };
}

describe('web-ui configuration', () => {
	let store: ReturnType<typeof initState>;
	beforeEach(() => {
		store = initState(createMockEventDispatcher(), { callbacks: {} });
		registerWebUiConfig(store);
	});
	afterEach(() => store.dispose());

	it('supplies rendering defaults without adding them to project configuration', () => {
		const config = {};
		expect(getConfiguredFont(config)).toBe(DEFAULT_FONT);
		expect(getConfiguredPalette(config)).toEqual(resolvePalette());
		expect(config).toEqual({});
	});

	it('registers validation for every supported font', () => {
		const validator = store.getState().editorConfigValidators.font!;
		for (const font of FONT_NAMES) expect(validator.validate(entry('font', font))).toBeUndefined();
	});

	it('uses schema diagnostics for unsupported fonts and misspelled paths', () => {
		const { font, color } = store.getState().editorConfigValidators;
		expect(font!.validate(entry('font', 'terminus8x16bld'))).toBe(
			"@config font: invalid value 'terminus8x16bld' Did you mean 'terminus8x16bold'?"
		);
		expect(color!.validate(entry('color.fill.waveform', '#fff'))).toContain('unknown config path');
		expect(color!.validate(entry('color.primar', '#fff'))).toContain("Did you mean 'color.primary'?");
	});

	it('registers validation for the shared base colors', () => {
		const validator = store.getState().editorConfigValidators.color!;
		for (const name of BASE_COLORS) {
			for (const value of ['#abc', '#112233', 'rgba(1,2,3,0.6)']) {
				expect(validator.validate(entry(`color.${name}`, value))).toBeUndefined();
			}
		}
	});

	it.each(['???', '#12345', 'red', 'rgba(0,0,0,2)'])('rejects invalid base colors: %s', value => {
		expect(store.getState().editorConfigValidators.color!.validate(entry('color.ink', value))).toBe(
			`@config color.ink: invalid color value '${value}'`
		);
	});

	it('resolves settings through project loading, editing, and replacement', () => {
		const state = store.getState();
		store.set('initialProjectState', {
			...EMPTY_DEFAULT_PROJECT,
			notes: [{ id: 0, code: ['note settings', '; @config font 6x10', '; @config color.primary #123456', 'noteEnd'] }],
		});
		expect(state.editorConfig).toEqual({ font: '6x10', color: { primary: '#123456' } });
		expect(state.codeErrors.editorDirectiveErrors).toEqual([]);
		const codeBlock = state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'settings')!;
		applyCodeBlockSourceEdits(
			store,
			[{ codeBlock, code: ['note settings', '; @config font tiny', '; @config color.primary ???', 'noteEnd'] }],
			{ affectsCompilation: false }
		);
		expect(state.editorConfig).toEqual({});
		expect(state.codeErrors.editorDirectiveErrors.map(error => error.lineNumber)).toEqual([1, 2]);
		store.set('initialProjectState', EMPTY_DEFAULT_PROJECT);
		expect(state.editorConfig).toEqual({});
		expect(state.codeErrors.editorDirectiveErrors).toEqual([]);
	});
});
