import type { EditorConfig, EditorConfigSchemaContribution } from '@8f4e/editor-state-types';

export const DEFAULT_RECOMPILE_DEBOUNCE_DELAY = 500;

export const compilerEditorConfigSchemaContribution: EditorConfigSchemaContribution = {
	root: 'recompileDebounceDelay',
	schema: { type: 'integer', minimum: 0 },
};

export function getRecompileDebounceDelay(config: EditorConfig): number {
	const delay = config.recompileDebounceDelay;
	return typeof delay === 'number' ? delay : DEFAULT_RECOMPILE_DEBOUNCE_DELAY;
}
