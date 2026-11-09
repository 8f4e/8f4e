import { resolveSchemaConfigRoot } from '@8f4e/editor-state';
import type { EditorConfig, EditorConfigSchemaContribution } from '@8f4e/editor-state-types';
import type { CompileOptions, FunctionInliningOptions } from '@8f4e/language-spec';

export const DEFAULT_RECOMPILE_DEBOUNCE_DELAY = 500;

export const compilerEditorConfigSchemaContribution: EditorConfigSchemaContribution = {
	root: 'recompileDebounceDelay',
	schema: { type: 'integer', minimum: 0 },
};

export const functionInliningSchemaContribution: EditorConfigSchemaContribution = {
	root: 'functionInlining',
	schema: {
		type: 'object',
		properties: {
			enabled: { type: 'boolean' },
			maxExpansionOperations: { type: 'integer', minimum: 0 },
			maxCallerGrowth: { type: 'integer', minimum: 0 },
		},
		additionalProperties: false,
	},
};

export function getRecompileDebounceDelay(config: EditorConfig): number {
	const delay = config.recompileDebounceDelay;
	return typeof delay === 'number' ? delay : DEFAULT_RECOMPILE_DEBOUNCE_DELAY;
}

export function getFunctionInliningOptions(
	config: EditorConfig
): Pick<CompileOptions, 'enableFunctionInlining' | 'functionInlining'> {
	const { enabled, ...limits } = resolveSchemaConfigRoot(functionInliningSchemaContribution, config) as {
		enabled?: boolean;
	} & FunctionInliningOptions;
	return {
		...(enabled !== undefined ? { enableFunctionInlining: enabled } : {}),
		...(Object.keys(limits).length > 0 ? { functionInlining: limits } : {}),
	};
}
