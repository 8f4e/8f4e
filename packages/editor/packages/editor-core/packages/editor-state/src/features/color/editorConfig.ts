import { BASE_COLORS, isPaletteColor } from '@8f4e/editor-palette';
import type { EditorConfigValidator, JSONSchemaLike, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { collectSchemaConfigPaths, createSchemaEditorConfigValidator } from '../editor-config/schemaValidator';
import { formatDidYouMeanSuffix } from '../global-editor-directives/suggestions';

const COLOR_CONFIG_ROOT = 'color';

const COLOR_SCHEMA: JSONSchemaLike = {
	type: 'object',
	properties: Object.fromEntries(BASE_COLORS.map(name => [name, { type: 'string' }])),
	additionalProperties: false,
};
const COLOR_CONFIG_PATHS = collectSchemaConfigPaths(COLOR_CONFIG_ROOT, COLOR_SCHEMA);

export const colorEditorConfigValidator: EditorConfigValidator = createSchemaEditorConfigValidator({
	root: COLOR_CONFIG_ROOT,
	schema: COLOR_SCHEMA,
	formatPathError: path => `@config: unknown config path '${path}'${formatDidYouMeanSuffix(path, COLOR_CONFIG_PATHS)}`,
	validateValue: (entry, schema) => {
		if (schema.type === 'string' && !isPaletteColor(entry.value)) {
			return `@config ${entry.path}: invalid color value '${entry.value}'`;
		}

		return undefined;
	},
});

export function registerColorEditorConfigValidator(store: StateManager<State>): void {
	store.set('editorConfigValidators.color', colorEditorConfigValidator);
}
