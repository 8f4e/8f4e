import { createSchemaEditorConfigValidator } from '@8f4e/editor-core';
import type { EditorConfigValidator, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';

export const RECOMPILE_DEBOUNCE_DELAY_CONFIG_PATH = 'recompileDebounceDelay';
export const DEFAULT_RECOMPILE_DEBOUNCE_DELAY = 500;

export const recompileDebounceDelayEditorConfigValidator: EditorConfigValidator = createSchemaEditorConfigValidator({
	root: RECOMPILE_DEBOUNCE_DELAY_CONFIG_PATH,
	schema: { type: 'integer', minimum: 0 },
	validateValue: entry => {
		const delay = Number(entry.value);

		return Number.isInteger(delay) && delay >= 0
			? undefined
			: `@config ${RECOMPILE_DEBOUNCE_DELAY_CONFIG_PATH}: delay must be a non-negative integer`;
	},
});

export function registerRecompileDebounceDelayEditorConfigValidator(store: Omit<StateManager<State>, 'dispose'>): void {
	store.set('editorConfigValidators.recompileDebounceDelay', recompileDebounceDelayEditorConfigValidator);
}
