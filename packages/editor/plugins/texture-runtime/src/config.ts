import { type EditorConfig, type EditorConfigSchemaContribution, resolveSchemaConfigRoot } from '@8f4e/editor-core';

export const TEXTURE_RUNTIME_CONFIG: EditorConfigSchemaContribution = {
	root: 'textureRuntime',
	defaults: { enabled: false, entry: 'main', magnification: 1, position: 'center' },
	schema: {
		type: 'object',
		properties: {
			enabled: { type: 'boolean' },
			entry: { type: 'string', pattern: '.+' },
			target: { type: 'string', pattern: '^[^:]+:[^:]+$' },
			width: { type: 'integer', minimum: 1 },
			height: { type: 'integer', minimum: 1 },
			magnification: { type: 'number', minimum: 1 },
			position: { type: 'string', enum: ['left', 'center', 'right'] },
		},
		additionalProperties: false,
	},
};

export interface TextureRuntimeConfig {
	entry: string;
	target: string;
	width: number;
	height: number;
	magnification: number;
	position: 'left' | 'center' | 'right';
}

export function readTextureRuntimeConfig(editorConfig: EditorConfig): TextureRuntimeConfig | undefined {
	const config = resolveSchemaConfigRoot(TEXTURE_RUNTIME_CONFIG, editorConfig);
	if (!config.enabled || !config.target || config.width === undefined || config.height === undefined) return undefined;
	return config as unknown as TextureRuntimeConfig;
}
