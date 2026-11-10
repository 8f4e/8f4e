import { resolveSchemaConfigRoot } from '@8f4e/editor-state';
import type { EditorConfig, EditorConfigSchemaContribution } from '@8f4e/editor-state-types';
import type { CompileOptions, FunctionInliningOptions } from '@8f4e/language-spec';

export const DEFAULT_RECOMPILE_DEBOUNCE_DELAY = 500;

export const recompileDebounceSchemaContribution: EditorConfigSchemaContribution = {
	root: 'recompileDebounceDelay',
	schema: { type: 'integer', minimum: 0 },
};

export const compilerEditorConfigSchemaContribution: EditorConfigSchemaContribution = {
	root: 'compiler',
	affectsCompilation: true,
	schema: {
		type: 'object',
		properties: {
			wasmPruning: {
				type: 'object',
				properties: { enabled: { type: 'boolean' } },
				additionalProperties: false,
			},
			functionInlining: {
				type: 'object',
				properties: {
					enabled: { type: 'boolean' },
					maxExpansionOperations: { type: 'integer', minimum: 0 },
					maxCallerGrowth: { type: 'integer', minimum: 0 },
				},
				additionalProperties: false,
			},
		},
		additionalProperties: false,
	},
};

export function getRecompileDebounceDelay(config: EditorConfig): number {
	const delay = config.recompileDebounceDelay;
	return typeof delay === 'number' ? delay : DEFAULT_RECOMPILE_DEBOUNCE_DELAY;
}

export function getCompilerOptimizationOptions(
	config: EditorConfig
): Pick<CompileOptions, 'enableWasmPruning' | 'enableFunctionInlining' | 'functionInlining'> {
	const { functionInlining, wasmPruning } = resolveSchemaConfigRoot(compilerEditorConfigSchemaContribution, config) as {
		wasmPruning?: { enabled?: boolean };
		functionInlining?: FunctionInliningOptions & { enabled?: boolean };
	};
	const { enabled, ...limits } = functionInlining ?? {};
	return {
		...(wasmPruning?.enabled !== undefined ? { enableWasmPruning: wasmPruning.enabled } : {}),
		...(enabled !== undefined ? { enableFunctionInlining: enabled } : {}),
		...(Object.keys(limits).length > 0 ? { functionInlining: limits } : {}),
	};
}
