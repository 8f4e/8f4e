import type { EditorConfigValidator, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { createSchemaEditorConfigValidator } from './schemaValidator';

export const EXPORT_FILE_NAME_CONFIG_PATH = 'export.fileName';

export const exportFileNameEditorConfigValidator: EditorConfigValidator = createSchemaEditorConfigValidator({
	root: 'export',
	schema: {
		type: 'object',
		properties: {
			fileName: { type: 'string' },
		},
		additionalProperties: false,
	},
	validateValue: entry =>
		entry.value.length > 0 ? undefined : `@config ${EXPORT_FILE_NAME_CONFIG_PATH}: file name must be non-empty`,
});

export function registerExportFileNameEditorConfigValidator(store: StateManager<State>): void {
	store.set('editorConfigValidators.exportFileName', exportFileNameEditorConfigValidator);
}
