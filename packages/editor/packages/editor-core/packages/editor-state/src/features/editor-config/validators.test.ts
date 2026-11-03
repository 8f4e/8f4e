import type { EditorConfigEntry, EditorConfigValidatorRegistry } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import { createSchemaEditorConfigValidator } from './schemaValidator';
import { getEditorConfigKnownPaths, resolveEditorConfigEntries, validateEditorConfigEntries } from './validators';

function entry(path: string, value: string): EditorConfigEntry {
	return {
		path,
		value,
		sourceLineIndex: 1,
		codeBlockId: 0,
	};
}

describe('editor config validators', () => {
	const registry: EditorConfigValidatorRegistry = {
		language: {
			knownPaths: ['language'],
			matches: path => path === 'language',
			validate: configEntry =>
				configEntry.value === 'sample' ? undefined : `unsupported language '${configEntry.value}'`,
		},
		settings: {
			knownPaths: ['settings.label'],
			matches: path => path.startsWith('settings.'),
			validate: configEntry =>
				configEntry.value !== 'invalid' ? undefined : `invalid settings value '${configEntry.value}'`,
		},
	};

	it('collects known paths from the supplied validator registry', () => {
		expect(getEditorConfigKnownPaths(registry)).toEqual(['language', 'settings.label']);
	});

	it('validates known config paths', () => {
		expect(
			validateEditorConfigEntries([entry('language', 'sample'), entry('settings.label', 'example')], registry)
		).toEqual([]);
	});

	it('returns errors from supplied validators', () => {
		const errors = validateEditorConfigEntries(
			[entry('language', 'invalid'), entry('settings.label', 'invalid')],
			registry
		);

		expect(errors).toHaveLength(2);
		expect(errors[0].message).toBe("unsupported language 'invalid'");
		expect(errors[1].message).toBe("invalid settings value 'invalid'");
	});

	it('reports unknown config paths with suggestions across registered features', () => {
		const errors = validateEditorConfigEntries([entry('languag', 'sample')], registry);

		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain("unknown config path 'languag'");
		expect(errors[0].message).toContain("Did you mean 'language'?");
	});

	it('resolves valid entries into a path-shaped config object', () => {
		expect(
			resolveEditorConfigEntries(
				[
					entry('language', 'sample'),
					entry('settings.label', 'example'),
					entry('language', 'invalid'),
					entry('unknown.path', 'value'),
				],
				registry
			)
		).toEqual({
			language: 'sample',
			settings: {
				label: 'example',
			},
		});
	});

	it('uses last-write-wins for duplicate valid paths', () => {
		expect(
			resolveEditorConfigEntries([entry('settings.label', 'first'), entry('settings.label', 'second')], registry)
		).toEqual({
			settings: {
				label: 'second',
			},
		});
	});

	it('uses validator parse hooks to store typed config values', () => {
		const typedRegistry: EditorConfigValidatorRegistry = {
			exampleCount: {
				knownPaths: ['exampleCount'],
				matches: path => path === 'exampleCount',
				validate: configEntry => (Number.isInteger(Number(configEntry.value)) ? undefined : 'invalid count'),
				parse: configEntry => Number(configEntry.value),
			},
		};

		expect(resolveEditorConfigEntries([entry('exampleCount', '120')], typedRegistry)).toEqual({
			exampleCount: 120,
		});
	});
});

describe('schema validator diagnostics', () => {
	const validator = createSchemaEditorConfigValidator({
		root: 'settings',
		schema: {
			type: 'object',
			properties: {
				mode: { type: 'string', enum: ['enabled', 'disabled'] },
				count: { type: 'integer', enum: [1, 2] },
			},
		},
	});

	it('suggests a declared enum value for misspelled string values', () => {
		expect(validator.validate(entry('settings.mode', 'enabld'))).toBe(
			"@config settings.mode: invalid value 'enabld' Did you mean 'enabled'?"
		);
	});

	it('suggests a declared schema path for unknown paths', () => {
		expect(validator.validate(entry('settings.moe', 'enabled'))).toBe(
			"@config: unknown config path 'settings.moe' Did you mean 'settings.mode'?"
		);
	});

	it('reports invalid numeric enum values without string suggestions', () => {
		expect(validator.validate(entry('settings.count', '3'))).toBe("@config settings.count: invalid value '3'");
	});
});
