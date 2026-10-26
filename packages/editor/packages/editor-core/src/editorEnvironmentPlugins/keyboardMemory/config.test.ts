import { createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import { getKeyboardMemoryConfig, keyboardEditorConfigSchemaContribution } from './config';

describe('keyboard memory editor config', () => {
	it('contributes a schema for keyboard memory targets', () => {
		expect(keyboardEditorConfigSchemaContribution).toMatchObject({
			root: 'keyboard',
			schema: {
				type: 'object',
				properties: {
					keyCodeMemory: {
						type: 'string',
					},
					keyPressedMemory: {
						type: 'string',
					},
				},
			},
		});
	});

	it('reads keyboard memory targets from editor config', () => {
		const state = createMockState({
			editorConfig: {
				keyboard: {
					keyCodeMemory: 'keys:code',
					keyPressedMemory: 'keys:pressed',
				},
			},
		});

		expect(getKeyboardMemoryConfig(state)).toEqual({
			keyCodeMemory: 'keys:code',
			keyPressedMemory: 'keys:pressed',
		});
	});
});
