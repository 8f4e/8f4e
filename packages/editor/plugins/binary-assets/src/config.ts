import type { EditorConfig, EditorConfigSchemaContribution } from '@8f4e/editor-state-types';

const MODULE_MEMORY_ID_SCHEMA = {
	type: 'string' as const,
	format: 'module-memory-id',
};

const BINARY_ASSET_SCHEMA = {
	type: 'object' as const,
	properties: {
		url: { type: 'string' as const, pattern: '^\\S+$' },
		path: { type: 'string' as const, pattern: '^\\S+$' },
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
		properties: {
			baseUrl: { type: 'string', pattern: '^\\S+$' },
		},
		additionalProperties: BINARY_ASSET_SCHEMA,
	},
};

/** Resolves standalone URLs first, otherwise joining asset paths to the optional base URL. */
export function resolveBinaryAssetLoadRequests(
	config: EditorConfig['bin']
): Array<{ id: string; url: string; memoryIds: string[] }> {
	const { baseUrl, ...assets } = (config ?? {}) as { baseUrl?: string };
	const entries = assets as Record<
		string,
		{ url?: string; path?: string; memory?: string; memories?: Record<string, string> }
	>;
	return Object.entries(entries).flatMap(([id, asset]) => {
		const url =
			asset.url ??
			(asset.path && (baseUrl ? `${baseUrl.replace(/\/+$/, '')}/${asset.path.replace(/^\/+/, '')}` : asset.path));
		if (!url) return [];
		const targets = [...(asset.memory ? [asset.memory] : []), ...Object.values(asset.memories ?? {})];
		return targets.length ? [{ id, url, memoryIds: [...new Set(targets)] }] : [];
	});
}
