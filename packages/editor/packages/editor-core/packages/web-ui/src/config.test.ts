import { resolvePalette } from '@8f4e/editor-palette';
import initState, { applyCodeBlockSourceEdits, EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { createMockEventDispatcher } from '@8f4e/editor-state-testing';
import { DEFAULT_FONT } from '@8f4e/sprite-generator';
import { describe, expect, it } from 'vitest';
import { getConfiguredFont, getConfiguredPalette, registerWebUiConfig } from './config';

describe('web-ui configuration', () => {
	it('supplies rendering defaults without adding them to project configuration', () => {
		const config = {};
		expect(getConfiguredFont(config)).toBe(DEFAULT_FONT);
		expect(getConfiguredPalette(config)).toEqual(resolvePalette());
		expect(config).toEqual({});
	});

	it('contributes validation and resolves settings through project loading, editing, and replacement', () => {
		const store = initState(createMockEventDispatcher(), { callbacks: {} });
		registerWebUiConfig(store);
		const state = store.getState();
		try {
			store.set('initialProjectState', {
				...EMPTY_DEFAULT_PROJECT,
				notes: [
					{ id: 0, code: ['note settings', '; @config font 6x10', '; @config color.primary #123456', 'noteEnd'] },
				],
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
		} finally {
			store.dispose();
		}
	});
});
