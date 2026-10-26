import type { EditorConfigEntry, EditorConfigValidatorRegistry } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
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
		font: {
			knownPaths: ['font'],
			matches: path => path === 'font',
			validate: configEntry => (configEntry.value === '6x10' ? undefined : `unsupported font '${configEntry.value}'`),
		},
		color: {
			knownPaths: ['color.text.code'],
			matches: path => path.startsWith('color.'),
			validate: configEntry =>
				configEntry.value.startsWith('#') ? undefined : `invalid color value '${configEntry.value}'`,
		},
	};

	it('collects known paths from the supplied validator registry', () => {
		expect(getEditorConfigKnownPaths(registry)).toEqual(['font', 'color.text.code']);
	});

	it('validates known config paths', () => {
		expect(validateEditorConfigEntries([entry('font', '6x10'), entry('color.text.code', '#112233')], registry)).toEqual(
			[]
		);
	});

	it('returns errors from supplied validators', () => {
		const errors = validateEditorConfigEntries([entry('font', 'tiny'), entry('color.text.code', '???')], registry);

		expect(errors).toHaveLength(2);
		expect(errors[0].message).toBe("unsupported font 'tiny'");
		expect(errors[1].message).toBe("invalid color value '???'");
	});

	it('reports unknown config paths with suggestions across registered features', () => {
		const errors = validateEditorConfigEntries([entry('fon', '6x10')], registry);

		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain("unknown config path 'fon'");
		expect(errors[0].message).toContain("Did you mean 'font'?");
	});

	it('resolves valid entries into a path-shaped config object', () => {
		expect(
			resolveEditorConfigEntries(
				[
					entry('font', '6x10'),
					entry('color.text.code', '#112233'),
					entry('font', 'tiny'),
					entry('unknown.path', 'value'),
				],
				registry
			)
		).toEqual({
			font: '6x10',
			color: {
				text: { code: '#112233' },
			},
		});
	});

	it('uses last-write-wins for duplicate valid paths', () => {
		expect(
			resolveEditorConfigEntries([entry('color.text.code', '#111111'), entry('color.text.code', '#222222')], registry)
		).toEqual({
			color: {
				text: { code: '#222222' },
			},
		});
	});

	it('uses validator parse hooks to store typed config values', () => {
		const typedRegistry: EditorConfigValidatorRegistry = {
			recompileDebounceDelay: {
				knownPaths: ['recompileDebounceDelay'],
				matches: path => path === 'recompileDebounceDelay',
				validate: configEntry => (Number.isInteger(Number(configEntry.value)) ? undefined : 'invalid delay'),
				parse: configEntry => Number(configEntry.value),
			},
		};

		expect(resolveEditorConfigEntries([entry('recompileDebounceDelay', '120')], typedRegistry)).toEqual({
			recompileDebounceDelay: 120,
		});
	});
});
