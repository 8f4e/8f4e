import type {
	EditorConfigSchemaContribution,
	EditorConfigSchemaContributionRegistry,
	EditorConfigValidator,
	State,
} from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import {
	collectSchemaConfigPaths,
	getSchemaForConfigPath,
	parseSchemaConfigValue,
	validateSchemaConfigValue,
} from './schemaValidator';
import { formatDidYouMeanSuffix } from './suggestions';

export const EDITOR_CONFIG_SCHEMA_CONTRIBUTIONS_VALIDATOR_ID = 'schemaContributions';

function getContributions(registry: EditorConfigSchemaContributionRegistry): EditorConfigSchemaContribution[] {
	return Object.values(registry).filter((contribution): contribution is EditorConfigSchemaContribution =>
		Boolean(contribution)
	);
}

function getKnownPaths(registry: EditorConfigSchemaContributionRegistry): string[] {
	const paths = getContributions(registry).flatMap(contribution =>
		collectSchemaConfigPaths(contribution.root, contribution.schema)
	);

	return Array.from(new Set(paths));
}

function isPermissiveObjectSchema(contribution: EditorConfigSchemaContribution): boolean {
	return (
		contribution.schema.type === 'object' &&
		!contribution.schema.properties &&
		contribution.schema.additionalProperties !== false
	);
}

function isPathUnderContributionRoot(contribution: EditorConfigSchemaContribution, path: string): boolean {
	return path === contribution.root || path.startsWith(`${contribution.root}.`);
}

function getContributionForPath(
	registry: EditorConfigSchemaContributionRegistry,
	path: string
): EditorConfigSchemaContribution | undefined {
	return getContributions(registry).find(
		contribution =>
			getSchemaForConfigPath(contribution.root, contribution.schema, path) ||
			(isPermissiveObjectSchema(contribution) && isPathUnderContributionRoot(contribution, path))
	);
}

export function createEditorConfigSchemaContributionsValidator(store: StateManager<State>): EditorConfigValidator {
	return {
		get knownPaths() {
			return getKnownPaths(store.getState().editorConfigSchemaContributions);
		},
		matches: path =>
			getContributions(store.getState().editorConfigSchemaContributions).some(contribution =>
				isPathUnderContributionRoot(contribution, path)
			),
		validate: entry => {
			const registry = store.getState().editorConfigSchemaContributions;
			const contribution = getContributionForPath(registry, entry.path);
			const knownPaths = getKnownPaths(registry);

			if (!contribution) {
				return `@config: unknown config path '${entry.path}'${formatDidYouMeanSuffix(entry.path, knownPaths)}`;
			}

			const schema = getSchemaForConfigPath(contribution.root, contribution.schema, entry.path);

			if (!schema) {
				return isPermissiveObjectSchema(contribution)
					? undefined
					: `@config: unknown config path '${entry.path}'${formatDidYouMeanSuffix(entry.path, knownPaths)}`;
			}

			return validateSchemaConfigValue(entry, schema);
		},
		parse: entry => {
			const registry = store.getState().editorConfigSchemaContributions;
			const contribution = getContributionForPath(registry, entry.path);
			const schema = contribution && getSchemaForConfigPath(contribution.root, contribution.schema, entry.path);

			return schema ? parseSchemaConfigValue(entry.value, schema, entry) : entry.value;
		},
	};
}

export function registerEditorConfigSchemaContributionsValidator(store: StateManager<State>): void {
	store.set(
		`editorConfigValidators.${EDITOR_CONFIG_SCHEMA_CONTRIBUTIONS_VALIDATOR_ID}`,
		createEditorConfigSchemaContributionsValidator(store)
	);
}
