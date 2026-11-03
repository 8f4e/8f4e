import type { EditorConfigSchemaContribution, State } from '@8f4e/editor-state-types';

const MODULE_MEMORY_ID_SCHEMA = {
	type: 'string' as const,
	format: 'module-memory-id',
};

export const keyboardEditorConfigSchemaContribution: EditorConfigSchemaContribution = {
	root: 'keyboard',
	schema: {
		type: 'object',
		properties: {
			keyCodeMemory: MODULE_MEMORY_ID_SCHEMA,
			keyPressedMemory: MODULE_MEMORY_ID_SCHEMA,
		},
		additionalProperties: false,
	},
};

export function getKeyboardMemoryConfig(state: State) {
	return state.editorConfig.keyboard as { keyCodeMemory?: string; keyPressedMemory?: string } | undefined;
}
