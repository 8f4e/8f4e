import { IncludeErrorCode } from '@8f4e/language-spec';
import { parseLine } from '@8f4e/tokenizer';
import { describe, expect, it } from 'vitest';
import {
	collectProjectIncludeIdsFromBlock,
	collectProjectIncludeIdsFromText,
	resolveProjectIncludesAsync,
} from './functionIncludes';

const selectableSource = [
	'function originalFirst',
	'#export first',
	'param int value',
	'call helper value',
	'call second',
	'functionEnd int',
	'function originalFirst',
	'#export first',
	'param float value',
	'call helper value',
	'functionEnd float',
	'function second',
	'#export',
	'param int value',
	'call helper value',
	'functionEnd int',
	'function helper',
	'param int value',
	'push value',
	'functionEnd int',
	'function helper',
	'param float value',
	'push value',
	'functionEnd float',
].join('\n');

function includeBlock(...declarations: string[]) {
	return { id: 42, code: ['includes', ...declarations, 'includesEnd'] };
}

describe('include function expansion', () => {
	const resolveInclude = (source: string) =>
		resolveProjectIncludesAsync([includeBlock('include std/test')], () => source);

	it('preserves source text and records bindings for each body and its dependencies', async () => {
		const functions = await resolveInclude(
			[
				'function first',
				'#export',
				'call helper',
				'functionEnd int',
				'function helper',
				'param int value',
				'functionEnd int',
			].join('\n')
		);
		expect(functions[0]!.code).toEqual(['function first', '', 'call helper', 'functionEnd int']);
		expect(functions[0]!.bindings.functionName).toBe('first');
		expect(functions[0]!.bindings.callTargets.get('helper')).toBe('__8f4e_std_test__nonexported__helper');
		expect(functions[1]!.code).toEqual(['function helper', 'param int value', 'functionEnd int']);
		expect(functions[1]!.bindings.functionName).toBe('__8f4e_std_test__nonexported__helper');
	});

	it('uses include-local export aliases as the public binding names', async () => {
		const functions = await resolveInclude('function internalName\n#export publicName\nfunctionEnd');
		expect(functions[0]!.bindings.functionName).toBe('publicName');
		expect(functions[0]!.code).toEqual(['function internalName', '', 'functionEnd']);
	});

	it('keeps partially exported overloads distinct and marks their shared name as ambiguous', async () => {
		const functions = await resolveInclude(
			[
				'function convert',
				'#export',
				'param int value',
				'functionEnd int',
				'function convert',
				'param float value',
				'functionEnd float',
			].join('\n')
		);
		expect(functions.map(func => func.bindings.functionName)).toEqual([
			'convert',
			'__8f4e_std_test__nonexported__convert',
		]);
		expect(new Set(functions.map(func => func.source.symbolName)).size).toBe(2);
		expect(functions[0]!.bindings.callTargets.get('convert')).toBeNull();
	});

	it('rejects sources without exported functions', async () => {
		await expect(resolveInclude('function helper\nfunctionEnd')).rejects.toThrow(
			'include "std/test" must export at least one function'
		);
	});

	it('keeps the file identity and project include site when include syntax fails', async () => {
		await expect(resolveInclude('function helper\n#export first second\nfunctionEnd')).rejects.toMatchObject({
			diagnostic: {
				location: {
					kind: 'include-file',
					includeId: 'std/test',
					lineNumber: 1,
					includeSite: { projectBlockId: 42, projectGroupPath: '', lineNumber: 1 },
				},
			},
		});
	});
});

describe('include export selections', () => {
	it('resolves multiple sources and their include metadata', async () => {
		const functions = await resolveProjectIncludesAsync(
			[includeBlock('include std/first', 'include std/second')],
			includeId => `function ${includeId.split('/')[1]}\n#export\nfunctionEnd`
		);
		expect(functions.map(func => [func.source.includeId, func.bindings.functionName])).toEqual([
			['std/first', 'first'],
			['std/second', 'second'],
		]);
	});

	it('selects the whole public overload family, keeping unselected exports as internal dependencies', async () => {
		const functions = await resolveProjectIncludesAsync(
			[includeBlock('include std/test first')],
			() => selectableSource
		);
		expect(functions.map(func => func.bindings.functionName)).toEqual([
			'first',
			'first',
			'__8f4e_std_test__unselected__second',
			'__8f4e_std_test__nonexported__helper',
			'__8f4e_std_test__nonexported__helper',
		]);
		expect(functions[0]!.bindings.callTargets.get('second')).toBe('__8f4e_std_test__unselected__second');
	});

	it('merges selected exports and identical selections, loading each source once', async () => {
		const loaded: string[] = [];
		const functions = await resolveProjectIncludesAsync(
			[includeBlock('include std/test first a', 'include std/test second b', 'include std/test first a')],
			async includeId => {
				loaded.push(includeId);
				return selectableSource;
			}
		);
		expect(loaded).toEqual(['std/test']);
		expect(functions).toHaveLength(5);
		expect(functions.map(func => func.bindings.functionName)).toEqual([
			'a',
			'a',
			'b',
			'__8f4e_std_test__nonexported__helper',
			'__8f4e_std_test__nonexported__helper',
		]);
		expect(functions[0]!.code).toContain('call helper value');
		expect(functions[0]!.bindings.callTargets.get('second')).toBe('b');
	});

	it('preserves original source through syntax validation when selections or names change', async () => {
		const all = await resolveProjectIncludesAsync([includeBlock('include std/test')], () => selectableSource);
		const selected = await resolveProjectIncludesAsync(
			[includeBlock('include std/test first renamed')],
			() => selectableSource
		);
		expect(selected.map(func => func.code)).toEqual(all.map(func => func.code));
		expect(selected[0]!.bindings.functionName).toBe('renamed');
	});

	it('deduplicates repeated include-all declarations', async () => {
		const functions = await resolveProjectIncludesAsync(
			[includeBlock('include std/test', 'include std/test')],
			() => selectableSource
		);
		expect(functions).toHaveLength(5);
		expect(functions.map(func => func.bindings.functionName)).toEqual([
			'first',
			'first',
			'second',
			'__8f4e_std_test__nonexported__helper',
			'__8f4e_std_test__nonexported__helper',
		]);
	});

	it.each([
		['include std/test first a', 'include std/test first b'],
		['include std/test', 'include std/test first renamed'],
		['include std/test first renamed', 'include std/test'],
	])('rejects conflicting names for one export: %s, %s', async (...declarations) => {
		await expect(
			resolveProjectIncludesAsync([includeBlock(...declarations)], () => selectableSource)
		).rejects.toMatchObject(
			expect.objectContaining({
				diagnostic: expect.objectContaining({
					code: IncludeErrorCode.CONFLICTING_BINDING,
					location: { kind: 'block', lineNumber: 2, projectBlockId: 42, projectGroupPath: '' },
				}),
				message: expect.stringContaining('is already included as'),
			})
		);
	});

	it('leaves collisions between different exports to ordinary namespace validation', async () => {
		const functions = await resolveProjectIncludesAsync(
			[includeBlock('include std/test first sameName', 'include std/test second sameName')],
			() => selectableSource
		);
		expect(functions.slice(0, 3).map(func => func.bindings.functionName)).toEqual(['sameName', 'sameName', 'sameName']);
	});

	it.each(['missing', 'helper', 'originalFirst'])(
		'rejects non-public selections with declaration diagnostics: %s',
		async name => {
			await expect(
				resolveProjectIncludesAsync([includeBlock(`include std/test ${name}`)], () => selectableSource)
			).rejects.toMatchObject(
				expect.objectContaining({
					message: `include "std/test" does not export "${name}"`,
					diagnostic: expect.objectContaining({
						code: IncludeErrorCode.UNKNOWN_EXPORT,
						location: { kind: 'block', lineNumber: 1, projectBlockId: 42, projectGroupPath: '' },
					}),
				})
			);
		}
	);

	it('skips disabled include blocks', async () => {
		const functions = await resolveProjectIncludesAsync(
			[
				{ ...includeBlock('include std/missing helper alias'), disabled: true },
				includeBlock('include std/test second'),
			],
			includeId => (includeId === 'std/test' ? selectableSource : undefined)
		);
		expect(functions.map(func => func.bindings.functionName)).toEqual([
			'__8f4e_std_test__unselected__first',
			'__8f4e_std_test__unselected__first',
			'second',
			'__8f4e_std_test__nonexported__helper',
			'__8f4e_std_test__nonexported__helper',
		]);
	});

	it('rewrites recursive source-name and export-alias calls to one identity', async () => {
		const functions = await resolveProjectIncludesAsync([includeBlock('include std/test publicName localName')], () =>
			['function sourceName', '#export publicName', 'call sourceName', 'call publicName', 'functionEnd'].join('\n')
		);
		expect(functions[0]!.bindings.functionName).toBe('localName');
		expect(functions[0]!.code).toEqual([
			'function sourceName',
			'',
			'call sourceName',
			'call publicName',
			'functionEnd',
		]);
		expect(functions[0]!.bindings.callTargets.get('sourceName')).toBe('localName');
		expect(functions[0]!.bindings.callTargets.get('publicName')).toBe('localName');
	});

	it('keeps distinct export aliases under distinct identities when unselected', async () => {
		const functions = await resolveProjectIncludesAsync([includeBlock('include std/test selected')], () =>
			[
				'function sameSourceName',
				'#export first',
				'functionEnd',
				'function sameSourceName',
				'#export second',
				'functionEnd',
				'function selected',
				'#export',
				'functionEnd',
			].join('\n')
		);
		expect(functions.map(func => func.bindings.functionName)).toEqual([
			'__8f4e_std_test__unselected__first',
			'__8f4e_std_test__unselected__second',
			'selected',
		]);
		expect(new Set(functions.map(func => func.source.symbolName)).size).toBe(3);
	});

	it('keeps export and helper names separate and preserves source-name call precedence', async () => {
		const functions = await resolveProjectIncludesAsync([includeBlock('include std/test selected')], () =>
			[
				'function sourceName',
				'#export helper',
				'call helper',
				'functionEnd',
				'function helper',
				'functionEnd',
				'function selected',
				'#export',
				'call sourceName',
				'functionEnd',
			].join('\n')
		);
		expect(new Set(functions.map(func => func.source.symbolName)).size).toBe(3);
		expect(functions[0]!.bindings.callTargets.get('helper')).toBe('__8f4e_std_test__nonexported__helper');
		expect(functions[2]!.bindings.callTargets.get('sourceName')).toBe('__8f4e_std_test__unselected__helper');
	});

	it('reports unresolved includes with block-relative diagnostics', async () => {
		await expect(
			resolveProjectIncludesAsync([includeBlock('include std/missing')], () => undefined)
		).rejects.toMatchObject({
			diagnostic: expect.objectContaining({
				code: IncludeErrorCode.UNRESOLVED_INCLUDE,
				location: { kind: 'block', lineNumber: 1, projectBlockId: 42, projectGroupPath: '' },
			}),
			message: 'unresolved include "std/missing"',
		});
	});

	it('collects source ids from selected and renamed includes', () => {
		expect(
			collectProjectIncludeIdsFromText(
				'8f4e/v1\nincludes\ninclude std/test first a\ninclude std/other second\nincludesEnd'
			)
		).toEqual(['std/test', 'std/other']);
	});

	it.each(['include', 'include std/test first alias extra'])('rejects malformed declarations: %s', line => {
		expect(() => collectProjectIncludeIdsFromBlock(includeBlock(line))).toThrow(
			expect.objectContaining({
				message: 'include expects <path> [exportedName [localName]]',
				diagnostic: expect.objectContaining({
					code: IncludeErrorCode.INVALID_DECLARATION,
					location: { kind: 'block', projectBlockId: 42, projectGroupPath: '', lineNumber: 1 },
				}),
			})
		);
	});
});

describe('include dependencies', () => {
	function library(name: string, dependency?: string) {
		const includes = dependency ? `includes\ninclude ${dependency}\nincludesEnd\n` : '';
		return `${includes}function ${name}\n#export\nfunctionEnd`;
	}

	it('shares a private dependency across importers and loads each file once', async () => {
		const sources = new Map([
			['std/left', library('left', 'std/shared')],
			['std/right', library('right', 'std/shared')],
			['std/shared', library('shared')],
		]);
		const loads: string[] = [];
		const functions = await resolveProjectIncludesAsync(
			[includeBlock('include std/left', 'include std/right', 'include std/shared shared publicShared')],
			id => {
				loads.push(id);
				return sources.get(id);
			}
		);
		expect(loads).toEqual(['std/left', 'std/shared', 'std/right']);
		const [left, right, direct, dependency] = functions;
		expect(functions).toHaveLength(4);
		expect(direct.bindings.functionName).toBe('publicShared');
		expect(parseLine(`call ${dependency.bindings.functionName}`, 0).ok).toBe(false);
		expect(left.bindings.callTargets.get('shared')).toBe(dependency.bindings.functionName);
		expect(right.bindings.callTargets.get('shared')).toBe(dependency.bindings.functionName);
	});

	it('reports a missing dependency at the importing file and retains the project include site', async () => {
		await expect(
			resolveProjectIncludesAsync(
				[includeBlock('include std/first')],
				id => (id === 'std/first' ? library('first', 'std/missing') : undefined),
				'audio'
			)
		).rejects.toMatchObject({
			message: 'unresolved include "std/missing" (from std/first)',
			diagnostic: {
				code: IncludeErrorCode.UNRESOLVED_INCLUDE,
				location: {
					kind: 'include-file',
					includeId: 'std/first',
					lineNumber: 1,
					includeSite: { projectBlockId: 42, projectGroupPath: 'audio', lineNumber: 1 },
				},
			},
		});
	});

	it('reports the full dependency cycle on the line that closes it', async () => {
		const sources = new Map([
			['std/first', library('first', 'std/second')],
			['std/second', library('second', 'std/first')],
		]);
		await expect(
			resolveProjectIncludesAsync([includeBlock('include std/first')], id => sources.get(id))
		).rejects.toMatchObject({
			message: 'include cycle: std/first -> std/second -> std/first',
			diagnostic: {
				code: IncludeErrorCode.DEPENDENCY_CYCLE,
				location: { kind: 'include-file', includeId: 'std/second', lineNumber: 1 },
			},
		});
	});
});
