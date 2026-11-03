import { BASE_COLORS, isPaletteColor, type PaletteConfig, resolvePalette } from '@8f4e/editor-palette';
import {
	collectSchemaConfigPaths,
	createSchemaEditorConfigValidator,
	formatDidYouMeanSuffix,
} from '@8f4e/editor-state';
import type { EditorConfig, EditorConfigValidator, JSONSchemaLike, State } from '@8f4e/editor-state-types';
import { DEFAULT_FONT, FONT_NAMES, type Font } from '@8f4e/sprite-generator';
import type { StateManager } from '@8f4e/state-manager';

const ALLOWED_FONTS = new Set<Font>(FONT_NAMES);

export const fontEditorConfigValidator: EditorConfigValidator = createSchemaEditorConfigValidator({
	root: 'font',
	schema: { type: 'string', enum: FONT_NAMES },
	validateValue: entry =>
		ALLOWED_FONTS.has(entry.value as Font)
			? undefined
			: `@config font: unsupported font '${entry.value}'${formatDidYouMeanSuffix(entry.value, FONT_NAMES)}`,
});

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

export function registerWebUiConfig(store: StateManager<State>): void {
	store.set('editorConfigValidators.font', fontEditorConfigValidator);
	store.set('editorConfigValidators.color', colorEditorConfigValidator);
}

export function getConfiguredFont(config: EditorConfig): Font {
	return (config.font as Font | undefined) ?? DEFAULT_FONT;
}

export function getConfiguredPalette(config: EditorConfig) {
	return resolvePalette(config.color as PaletteConfig | undefined);
}
