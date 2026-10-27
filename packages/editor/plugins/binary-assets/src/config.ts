import type { EditorConfig, EditorConfigSchemaContribution } from '@8f4e/editor-state-types';

const MODULE_MEMORY_ID_SCHEMA = {
	type: 'string' as const,
	format: 'module-memory-id',
};

const BINARY_ASSET_SCHEMA = {
	type: 'object' as const,
	properties: {
		url: { type: 'string' as const, pattern: '^\\S+$' },
		memory: MODULE_MEMORY_ID_SCHEMA,
		memories: {
			type: 'object' as const,
			additionalProperties: MODULE_MEMORY_ID_SCHEMA,
		},
	},
	additionalProperties: false,
};

export const binaryAssetsEditorConfigSchemaContribution: EditorConfigSchemaContribution = {
	root: 'bin',
	schema: {
		type: 'object',
		additionalProperties: BINARY_ASSET_SCHEMA,
	},
};

export function resolveBinaryAssetLoadRequests(
	config: EditorConfig['bin']
): Array<{ id: string; url: string; memoryId: string }> {
	const entries = (config ?? {}) as Record<
		string,
		{ url?: string; memory?: string; memories?: Record<string, string> }
	>;
	return Object.entries(entries).flatMap(([id, asset]) => {
		const { url } = asset;
		if (!url) return [];
		const targets = [...(asset.memory ? [asset.memory] : []), ...Object.values(asset.memories ?? {})];
		return targets.map(memoryId => ({ id, url, memoryId }));
	});
}
