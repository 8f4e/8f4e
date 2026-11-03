import type {
	EditorConfig,
	EditorConfigEntry,
	EditorConfigObject,
	EditorConfigPrimitiveValue,
	EditorConfigSchemaContribution,
	EditorConfigValidator,
	JSONSchemaLike,
	State,
} from '@8f4e/editor-state-types';
import resolveMemoryIdentifier from '../../pureHelpers/resolveMemoryIdentifier';
import { isMemoryId } from '../../shared/editorDirectiveArgumentTypes';

export interface SchemaEditorConfigValidatorOptions {
	root: string;
	schema: JSONSchemaLike;
	formatPathError?: (path: string, knownPaths: string[]) => string;
	validateValue?: (entry: EditorConfigEntry, schema: JSONSchemaLike) => string | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMergeConfigRoot(
	defaults: Record<string, unknown>,
	overrides: EditorConfigObject | undefined
): Record<string, unknown> {
	const merged: Record<string, unknown> = { ...defaults };

	if (!overrides) {
		return merged;
	}

	for (const [key, value] of Object.entries(overrides)) {
		if (value === undefined) {
			continue;
		}

		const defaultValue = merged[key];
		if (isRecord(defaultValue) && isRecord(value)) {
			merged[key] = deepMergeConfigRoot(defaultValue, value);
			continue;
		}

		merged[key] = value;
	}

	return merged;
}

function getEditorConfigRoot(config: EditorConfig, root: string): EditorConfigObject | undefined {
	const value = config[root];

	return isRecord(value) ? (value as EditorConfigObject) : undefined;
}

function getSchemaOptions(schema: JSONSchemaLike): JSONSchemaLike[] {
	return [schema, ...(schema.oneOf ?? []), ...(schema.anyOf ?? [])];
}

function qualifyMemoryIdentifier(value: string, moduleId: string | undefined): string | undefined {
	if (value.includes(':')) {
		return value;
	}

	return moduleId ? `${moduleId}:${value}` : undefined;
}

function resolveMemoryAddressConfigValue(state: State, value: unknown): number | undefined {
	if (typeof value === 'number') {
		return Number.isInteger(value) && value >= 0 ? value : undefined;
	}

	const trimmedValue = typeof value === 'string' ? value.trim() : '';
	if (!trimmedValue) {
		return undefined;
	}

	const numericAddress = Number(trimmedValue);
	if (Number.isInteger(numericAddress) && numericAddress >= 0) {
		return numericAddress;
	}

	return resolveMemoryIdentifier(state, { kind: 'project', groupPath: '' }, trimmedValue)?.memory.allocationUnitAddress;
}

function resolveFormattedConfigValues(value: unknown, schema: JSONSchemaLike, state: State | undefined): unknown {
	if (state && schema.format === 'memory-address') {
		return resolveMemoryAddressConfigValue(state, value);
	}

	if (Array.isArray(value)) {
		return value.map(item => (schema.items ? resolveFormattedConfigValues(item, schema.items, state) : item));
	}

	if (!isRecord(value)) {
		return value;
	}

	const resolved: Record<string, unknown> = { ...value };
	for (const option of getSchemaOptions(schema)) {
		for (const [key, childSchema] of Object.entries(option.properties ?? {})) {
			if (key in resolved) {
				resolved[key] = resolveFormattedConfigValues(resolved[key], childSchema, state);
			}
		}

		if (option.additionalProperties && typeof option.additionalProperties === 'object') {
			for (const [key, childValue] of Object.entries(resolved)) {
				if (!(key in (option.properties ?? {}))) {
					resolved[key] = resolveFormattedConfigValues(childValue, option.additionalProperties, state);
				}
			}
		}
	}

	return resolved;
}

export function resolveSchemaConfigRoot(
	contribution: EditorConfigSchemaContribution,
	editorConfig: EditorConfig,
	state?: State
): Record<string, unknown> {
	const config = deepMergeConfigRoot(contribution.defaults ?? {}, getEditorConfigRoot(editorConfig, contribution.root));
	return resolveFormattedConfigValues(config, contribution.schema, state) as Record<string, unknown>;
}

export function collectSchemaConfigPaths(root: string, schema: JSONSchemaLike): string[] {
	const paths: string[] = [];

	function visit(currentPath: string, currentSchema: JSONSchemaLike): void {
		const options = getSchemaOptions(currentSchema);
		for (const option of options) {
			if (option.type === 'object' || option.properties) {
				for (const [key, childSchema] of Object.entries(option.properties ?? {})) {
					visit(`${currentPath}.${key}`, childSchema);
				}

				if (option.additionalProperties && typeof option.additionalProperties === 'object') {
					visit(`${currentPath}.*`, option.additionalProperties);
				}
				continue;
			}

			if (option.type === 'array' && option.items) {
				visit(`${currentPath}.*`, option.items);
				continue;
			}

			paths.push(currentPath);
		}
	}

	visit(root, schema);

	return Array.from(new Set(paths));
}

export function getSchemaForConfigPath(root: string, schema: JSONSchemaLike, path: string): JSONSchemaLike | undefined {
	if (path === root) {
		return schema;
	}

	if (!path.startsWith(`${root}.`)) {
		return undefined;
	}

	const segments = path.slice(root.length + 1).split('.');
	let currentSchemas: JSONSchemaLike[] = [schema];

	for (const segment of segments) {
		const nextSchemas: JSONSchemaLike[] = [];

		for (const currentSchema of currentSchemas.flatMap(getSchemaOptions)) {
			const childSchema = currentSchema.properties?.[segment];
			if (childSchema) {
				nextSchemas.push(childSchema);
			}

			if (currentSchema.type === 'array' && currentSchema.items && /^\d+$/.test(segment)) {
				nextSchemas.push(currentSchema.items);
			}

			if (
				currentSchema.additionalProperties &&
				typeof currentSchema.additionalProperties === 'object' &&
				!childSchema
			) {
				nextSchemas.push(currentSchema.additionalProperties);
			}
		}

		if (nextSchemas.length === 0) {
			return undefined;
		}

		currentSchemas = nextSchemas;
	}

	return currentSchemas[0];
}

function parseBoolean(value: string): boolean | undefined {
	if (value === 'true') {
		return true;
	}

	if (value === 'false') {
		return false;
	}

	return undefined;
}

export function parseSchemaConfigValue(
	value: string,
	schema: JSONSchemaLike,
	entry?: EditorConfigEntry
): EditorConfigPrimitiveValue {
	if (!schema.type && schema.format === 'memory-address') {
		const numericAddress = Number(value);
		if (!Number.isInteger(numericAddress) || numericAddress < 0) {
			return qualifyMemoryIdentifier(value, entry?.moduleId) ?? value;
		}
	}

	const options = [...(schema.oneOf ?? []), ...(schema.anyOf ?? [])];
	if (!schema.type && options.length > 0) {
		const matchingOption = options.find(
			option =>
				validateSchemaConfigValue(
					{ path: '', value, sourceLineIndex: 0, codeBlockId: -1, moduleId: entry?.moduleId },
					{ ...option, format: option.format ?? schema.format }
				) === undefined
		);
		return matchingOption
			? parseSchemaConfigValue(value, { ...matchingOption, format: matchingOption.format ?? schema.format }, entry)
			: value;
	}

	if (schema.type === 'integer' || schema.type === 'number') {
		return Number(value);
	}

	if (schema.type === 'boolean') {
		return parseBoolean(value) ?? value;
	}

	if ((schema.format === 'memory-address' || schema.format === 'module-memory-id') && schema.type === 'string') {
		return qualifyMemoryIdentifier(value, entry?.moduleId) ?? value;
	}

	return value;
}

function validateModuleMemoryIdentifier(entry: EditorConfigEntry): string | undefined {
	if (!isMemoryId(entry.value)) {
		return `@config ${entry.path}: invalid string value '${entry.value}'`;
	}

	if (!entry.value.includes(':') && !entry.moduleId) {
		return `@config ${entry.path}: memory value '${entry.value}' must include a module id outside module blocks`;
	}

	return undefined;
}

export function validateSchemaConfigValue(entry: EditorConfigEntry, schema: JSONSchemaLike): string | undefined {
	const options = [...(schema.oneOf ?? []), ...(schema.anyOf ?? [])];
	if (!schema.type && options.length > 0) {
		const optionErrors = options.map(option =>
			validateSchemaConfigValue(entry, { ...option, format: option.format ?? schema.format })
		);
		if (optionErrors.some(error => error === undefined)) {
			return undefined;
		}

		return `@config ${entry.path}: invalid value '${entry.value}'`;
	}

	const parsedValue = parseSchemaConfigValue(entry.value, schema);

	if (schema.enum && !schema.enum.includes(parsedValue)) {
		return `@config ${entry.path}: invalid value '${entry.value}'`;
	}

	if (schema.type === 'integer') {
		if (!Number.isInteger(parsedValue)) {
			return `@config ${entry.path}: invalid integer value '${entry.value}'`;
		}
	}

	if (schema.type === 'number') {
		if (typeof parsedValue !== 'number' || !Number.isFinite(parsedValue)) {
			return `@config ${entry.path}: invalid number value '${entry.value}'`;
		}
	}

	if (schema.type === 'boolean' && typeof parsedValue !== 'boolean') {
		return `@config ${entry.path}: invalid boolean value '${entry.value}'`;
	}

	if (schema.type === 'string' && typeof parsedValue !== 'string') {
		return `@config ${entry.path}: invalid string value '${entry.value}'`;
	}

	if (schema.type === 'string' && (schema.format === 'memory-address' || schema.format === 'module-memory-id')) {
		return validateModuleMemoryIdentifier(entry);
	}

	if (schema.type === 'string' && schema.pattern && !new RegExp(schema.pattern).test(String(parsedValue))) {
		return `@config ${entry.path}: invalid string value '${entry.value}'`;
	}

	if (typeof parsedValue === 'number' && schema.minimum !== undefined && parsedValue < schema.minimum) {
		return `@config ${entry.path}: value ${entry.value} must be at least ${schema.minimum}`;
	}

	if (schema.type === 'object' && !isRecord(parsedValue)) {
		return `@config ${entry.path}: expected nested config values`;
	}

	return undefined;
}

export function createSchemaEditorConfigValidator({
	root,
	schema,
	formatPathError,
	validateValue,
}: SchemaEditorConfigValidatorOptions): EditorConfigValidator {
	return {
		get knownPaths() {
			return collectSchemaConfigPaths(root, schema);
		},
		matches: path => path === root || path.startsWith(`${root}.`),
		validate: entry => {
			const knownPaths = collectSchemaConfigPaths(root, schema);
			const entrySchema = getSchemaForConfigPath(root, schema, entry.path);

			if (!entrySchema) {
				return formatPathError?.(entry.path, knownPaths) ?? `@config: unknown config path '${entry.path}'`;
			}

			const customError = validateValue?.(entry, entrySchema);
			if (customError) {
				return customError;
			}

			return validateSchemaConfigValue(entry, entrySchema);
		},
		parse: entry => {
			const entrySchema = getSchemaForConfigPath(root, schema, entry.path);
			return entrySchema ? parseSchemaConfigValue(entry.value, entrySchema, entry) : entry.value;
		},
	};
}
