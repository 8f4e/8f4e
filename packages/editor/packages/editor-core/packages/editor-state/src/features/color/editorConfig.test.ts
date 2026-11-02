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
	it('validates the shared base colors', () => {
		for (const name of [
			'canvas',
			'surface',
			'ink',
			'muted',
			'primary',
			'secondary',
			'tertiary',
			'highlight',
			'detail',
			'stroke',
			'positive',
			'warning',
			'negative',
		]) {
			expect(colorEditorConfigValidator.validate(entry(`color.${name}`, '#abc'))).toBeUndefined();
			expect(colorEditorConfigValidator.validate(entry(`color.${name}`, '#112233'))).toBeUndefined();
			expect(colorEditorConfigValidator.validate(entry(`color.${name}`, 'rgba(1,2,3,0.6)'))).toBeUndefined();
		}
	});

	it('rejects feature paths and suggests misspelled base colors', () => {
		expect(colorEditorConfigValidator.validate(entry('color.fill.waveform', '#fff'))).toContain('unknown config path');
		expect(colorEditorConfigValidator.validate(entry('color.primar', '#fff'))).toContain(
			"Did you mean 'color.primary'?"
		);
	});

	it.each(['???', '#12345', 'red', 'rgba(0,0,0,2)'])('rejects invalid base colors: %s', value => {
		expect(colorEditorConfigValidator.validate(entry('color.ink', value))).toBe(
			`@config color.ink: invalid color value '${value}'`
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
