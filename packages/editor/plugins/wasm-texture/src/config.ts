import { type EditorConfig, type EditorConfigSchemaContribution, resolveSchemaConfigRoot } from '@8f4e/editor-core';

export const WASM_TEXTURE_CONFIG: EditorConfigSchemaContribution = {
	root: 'wasmTexture',
	defaults: { entry: 'main', magnification: 1, position: 'center' },
	schema: {
		type: 'object',
		properties: {
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

export interface TextureConfig {
	entry: string;
	target: string;
	width: number;
	height: number;
	magnification: number;
	position: 'left' | 'center' | 'right';
}

export function readTextureConfig(editorConfig: EditorConfig): TextureConfig | undefined {
	const config = resolveSchemaConfigRoot(WASM_TEXTURE_CONFIG, editorConfig);
	if (!config.target || config.width === undefined || config.height === undefined) return undefined;
	return config as unknown as TextureConfig;
}
