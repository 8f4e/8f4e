import type { EditorConfigEntry } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import { fontEditorConfigValidator } from './config';

function entry(value: string): EditorConfigEntry {
	return {
		path: 'font',
		value,
		sourceLineIndex: 1,
		codeBlockId: 0,
	};
}

describe('font editor config', () => {
	it('validates supported fonts', () => {
		expect(fontEditorConfigValidator.validate(entry('6x10'))).toBeUndefined();
	});

	it('reports unsupported fonts and suggests close matches', () => {
		const error = fontEditorConfigValidator.validate(entry('terminus8x16bld'));

		expect(error).toContain("unsupported font 'terminus8x16bld'");
		expect(error).toContain("Did you mean 'terminus8x16bold'?");
	});
});
