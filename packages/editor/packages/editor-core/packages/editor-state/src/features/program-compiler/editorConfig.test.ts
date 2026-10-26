import type { EditorConfigEntry } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import { RECOMPILE_DEBOUNCE_DELAY_CONFIG_PATH, recompileDebounceDelayEditorConfigValidator } from './editorConfig';

function entry(value: string): EditorConfigEntry {
	return {
		path: RECOMPILE_DEBOUNCE_DELAY_CONFIG_PATH,
		value,
		sourceLineIndex: 1,
		codeBlockId: 0,
	};
}

describe('program compiler editor config', () => {
	it('validates non-negative integer debounce delay values', () => {
		expect(recompileDebounceDelayEditorConfigValidator.validate(entry('0'))).toBeUndefined();
		expect(recompileDebounceDelayEditorConfigValidator.validate(entry('500'))).toBeUndefined();
		expect(recompileDebounceDelayEditorConfigValidator.validate(entry('-1'))).toBe(
			'@config recompileDebounceDelay: delay must be a non-negative integer'
		);
		expect(recompileDebounceDelayEditorConfigValidator.validate(entry('10.5'))).toBe(
			'@config recompileDebounceDelay: delay must be a non-negative integer'
		);
		expect(recompileDebounceDelayEditorConfigValidator.validate(entry('fast'))).toBe(
			'@config recompileDebounceDelay: delay must be a non-negative integer'
		);
	});

	it('parses debounce delay config values as numbers', () => {
		expect(recompileDebounceDelayEditorConfigValidator.parse?.(entry('120'))).toBe(120);
	});
});
