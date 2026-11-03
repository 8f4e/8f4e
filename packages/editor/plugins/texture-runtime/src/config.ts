import { type EditorConfig, type EditorConfigSchemaContribution, resolveSchemaConfigRoot } from '@8f4e/editor-core';

export const TEXTURE_RUNTIME_CONFIG: EditorConfigSchemaContribution = {
	root: 'textureRuntime',
	defaults: { enabled: false, entry: 'main' },
	schema: {
		type: 'object',
		properties: {
			enabled: { type: 'boolean' },
			entry: { type: 'string', pattern: '.+' },
		},
		additionalProperties: false,
	},
};

export function readTextureRuntimeConfig(editorConfig: EditorConfig): { enabled: boolean; entry: string } {
	return resolveSchemaConfigRoot(TEXTURE_RUNTIME_CONFIG, editorConfig) as { enabled: boolean; entry: string };
}
