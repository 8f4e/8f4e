import { createMockState } from '@8f4e/editor-state-testing';
import type { EditorConfigEntry, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { describe, expect, it } from 'vitest';
import { colorEditorConfigValidator } from './editorConfig';
import color from './effect';

function entry(path: string, value: string): EditorConfigEntry {
	return {
		path,
		value,
		sourceLineIndex: 1,
		codeBlockId: 0,
	};
}

describe('color editor config', () => {
	it('validates known color paths', () => {
		expect(colorEditorConfigValidator.validate(entry('color.text.code', '#112233'))).toBeUndefined();
		expect(colorEditorConfigValidator.validate(entry('color.text.entryName', '#abcdef'))).toBeUndefined();
		expect(colorEditorConfigValidator.validate(entry('color.text.controlKnob', '#ffe066'))).toBeUndefined();
		expect(colorEditorConfigValidator.validate(entry('color.fill.waveformBackground', 'transparent'))).toBeUndefined();
		expect(colorEditorConfigValidator.validate(entry('color.fill.controlKnob', '#334455'))).toBeUndefined();
		expect(colorEditorConfigValidator.validate(entry('color.fill.crossfadeHandle', '#556677'))).toBeUndefined();
	});

	it('reports unknown color paths with suggestions', () => {
		const error = colorEditorConfigValidator.validate(entry('color.text.cod', '#000000'));

		expect(error).toContain("unknown config path 'color.text.cod'");
		expect(error).toContain("Did you mean 'color.text.code'?");
	});

	it('reports invalid color values', () => {
		expect(colorEditorConfigValidator.validate(entry('color.text.code', '???'))).toBe(
			"@config color.text.code: invalid color value '???'"
		);
	});

	it('registers its validator in the shared editor-config validator slot', () => {
		const state = createMockState({ editorConfigValidators: {} });
		const store = {
			set: (path: string, value: unknown) => {
				if (path === 'editorConfigValidators.color') {
					state.editorConfigValidators.color = value as typeof colorEditorConfigValidator;
				}
			},
		} as StateManager<State>;

		color(store);

		expect(state.editorConfigValidators.color).toBe(colorEditorConfigValidator);
	});
});
