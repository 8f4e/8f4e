import { BASE_COLORS, isPaletteColor, type PaletteConfig, resolvePalette } from '@8f4e/editor-palette';
import { createSchemaEditorConfigValidator } from '@8f4e/editor-state';
import type { EditorConfig, State } from '@8f4e/editor-state-types';
import { DEFAULT_FONT, FONT_NAMES, type Font } from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';

const fontEditorConfigValidator = createSchemaEditorConfigValidator({
	root: 'font',
	schema: { type: 'string', enum: FONT_NAMES },
});

const colorEditorConfigValidator = createSchemaEditorConfigValidator({
	root: 'color',
	schema: {
		type: 'object',
		properties: Object.fromEntries(BASE_COLORS.map(name => [name, { type: 'string' }])),
		additionalProperties: false,
	},
	validateValue: (entry, schema) => {
		if (schema.type === 'string' && !isPaletteColor(entry.value)) {
			return `@config ${entry.path}: invalid color value '${entry.value}'`;
		}

		return undefined;
	},
});

export function registerWebUiConfig(store: StateManager<State>): void {
	store.set('editorConfigValidators.font', fontEditorConfigValidator);
	store.set('editorConfigValidators.color', colorEditorConfigValidator);
}

export function getConfiguredFont(config: EditorConfig, defaultFont: Font = DEFAULT_FONT): Font {
	return (config.font as Font | undefined) ?? defaultFont;
}

export function getConfiguredPalette(config: EditorConfig) {
	return resolvePalette(config.color as PaletteConfig | undefined);
}
