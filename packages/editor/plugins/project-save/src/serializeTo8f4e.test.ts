import { parseProjectSource } from '@8f4e/compiler';
import type { ProjectGroupObjectModel, ProjectObjectModel } from '@8f4e/language-spec';
import { getProjectGroups, getProjectModules } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { serializeProjectTo8f4e } from './serializeTo8f4e';

const validBlock = ['module counter', '', 'int count', '', 'moduleEnd'];
const validFunctionBlock = ['function sine', 'param float x', 'functionEnd float'];
const validNoteBlock = ['note', '; @pos 1 2', 'compiler should ignore this', 'noteEnd'];

function createProject(partial: Partial<ProjectObjectModel> = {}): ProjectObjectModel {
	return {
		entries: [],
		code: [],
		execution: [],
		functions: [],
		constants: [],
		prototypes: [],
		includes: [],
		notes: [],
		unknown: [],
		...partial,
	};
}

function createGroup(partial: Partial<ProjectGroupObjectModel>): ProjectGroupObjectModel {
	return {
		entry: 'main',

		...createProject(),
		type: 'group',
		id: 0,
		name: 'group',
		exposures: [],
		...partial,
	};
}

describe('serializeProjectTo8f4e', () => {
	it('round-trips interleaved modules and nested groups in each entry', () => {
		const source = `8f4e/v1

entry main
module rootA
moduleEnd
group synth
entry main
module voiceA
moduleEnd
group oscillator
entry main
module tick
moduleEnd
entryEnd
groupEnd
module voiceB
moduleEnd
entryEnd
groupEnd
module rootB
moduleEnd
entryEnd
entry alternate
group other
entry main
module otherVoice
moduleEnd
entryEnd
groupEnd
module otherRoot
moduleEnd
entryEnd`;
		const parsed = parseProjectSource(source);
		const serialized = serializeProjectTo8f4e(parsed);
		expect(serialized).toBe(source);
		expect(parseProjectSource(serialized)).toEqual(parsed);
	});

	it('produces 8f4e/v1 header', () => {
		const result = serializeProjectTo8f4e(
			createProject({ execution: [{ type: 'module', id: 1, code: validBlock, entry: 'main' }] })
		);
		expect(result.startsWith('8f4e/v1\n')).toBe(true);
	});

	it('serializes multiple block collections separated by blank lines', () => {
		const project = createProject({
			entries: ['main'],
			execution: [{ type: 'module', id: 1, code: validBlock, entry: 'main' }],
			functions: [{ id: 2, code: validFunctionBlock }],
			notes: [{ id: 3, code: validNoteBlock }],
		});
		const result = serializeProjectTo8f4e(project);
		expect(result).toContain('\n\n');
		expect(result).toContain('entry main\nmodule counter');
		expect(result).toContain('moduleEnd\nentryEnd');
	});

	it('serializes the visible includes collection', () => {
		const visibleIncludesBlock = ['includes', 'include std/events/risingEdge', 'includesEnd'];
		const project = createProject({
			includes: [{ id: 1, code: visibleIncludesBlock }],
			execution: [{ type: 'module', id: 2, code: validBlock, entry: 'main' }],
		});
		expect(serializeProjectTo8f4e(project)).toBe(
			['8f4e/v1', '', ...visibleIncludesBlock, '', 'entry main', ...validBlock, 'entryEnd'].join('\n')
		);
	});

	it('preserves module order within each entry', () => {
		const project = createProject({
			entries: ['main', 'test'],
			execution: [
				{ type: 'module', id: 1, code: ['module a', 'moduleEnd'], entry: 'main' },
				{ type: 'module', id: 3, code: ['module b', 'moduleEnd'], entry: 'test' },
				{ type: 'module', id: 4, code: ['module c', 'moduleEnd'], entry: 'main' },
			],
			functions: [{ id: 2, code: validFunctionBlock }],
		});
		expect(serializeProjectTo8f4e(project)).toBe(
			[
				'8f4e/v1',
				'',
				...validFunctionBlock,
				'',
				'entry main',
				'module a',
				'moduleEnd',
				'entryEnd',
				'entry test',
				'module b',
				'moduleEnd',
				'entryEnd',
				'entry main',
				'module c',
				'moduleEnd',
				'entryEnd',
			].join('\n')
		);
	});

	it('accepts note blocks', () => {
		expect(() => serializeProjectTo8f4e(createProject({ notes: [{ id: 1, code: validNoteBlock }] }))).not.toThrow();
	});

	it('handles an empty project', () => {
		expect(serializeProjectTo8f4e(createProject())).toBe('8f4e/v1\n\n');
	});

	it('round-trips editable root project-scope source', () => {
		const project = createProject({ code: ['; namespace contract', 'pass env'] });

		const text = serializeProjectTo8f4e(project);
		const parsed = parseProjectSource(text);

		expect(text).toBe(['8f4e/v1', '', '; namespace contract', 'pass env'].join('\n'));
		expect(parsed.code).toEqual(['; namespace contract', 'pass env']);
		expect(serializeProjectTo8f4e(parsed)).toBe(text);
	});

	it('round-trips canonical block collections through project text', () => {
		const project = createProject({
			entries: ['main'],
			execution: [{ type: 'module', id: 1, code: validBlock, entry: 'main' }],
			functions: [{ id: 2, code: validFunctionBlock }],
			notes: [{ id: 3, code: validNoteBlock }],
		});

		const parsed = parseProjectSource(serializeProjectTo8f4e(project));

		expect(getProjectModules(parsed)[0].code).toEqual(validBlock);
		expect(parsed.functions[0].code).toEqual(validFunctionBlock);
		expect(parsed.notes[0].code).toEqual(validNoteBlock);
	});

	it('round-trips recursively owned groups', () => {
		const project = createGroup({
			execution: [
				createGroup({
					entries: ['main'],
					name: 'audio',

					code: [
						'group audio',
						'; retain this group comment',
						'futureInstruction anything',
						'expose count &counter:count',
						'groupEnd',
					],
					exposures: [
						{
							name: 'count',
							lineNumber: 3,
							targetModuleName: 'counter',
							targetMemoryName: 'count',
						},
					],
					execution: [
						{ type: 'module', id: 1, code: validBlock, entry: 'main' },
						createGroup({
							entries: [],
							name: 'notes',

							code: ['group notes', 'groupEnd'],
							exposures: [],
							notes: [{ id: 3, code: validNoteBlock }],
						}),
					],
					functions: [{ id: 2, code: validFunctionBlock }],
				}),
			],
		});

		const parsed = parseProjectSource(serializeProjectTo8f4e(project));

		expect(getProjectGroups(parsed)[0]).toMatchObject({
			entries: ['main'],
			name: 'audio',

			code: [
				'group audio',
				'; retain this group comment',
				'futureInstruction anything',
				'expose count &counter:count',
				'groupEnd',
			],
			exposures: [
				{
					name: 'count',
					lineNumber: 3,
					targetModuleName: 'counter',
					targetMemoryName: 'count',
				},
			],
			execution: [
				{ type: 'module', code: validBlock, entry: 'main' },
				{ entry: 'main', entries: [], type: 'group', name: 'notes', notes: [{ code: validNoteBlock }] },
			],
			functions: [{ code: validFunctionBlock }],
		});
	});

	it('preserves empty local entries without introducing a main entry', () => {
		const source = '8f4e/v1\nentry main\ngroup idle\nentry foo\nentryEnd\nentry bar\nentryEnd\ngroupEnd\nentryEnd';
		const saved = serializeProjectTo8f4e(parseProjectSource(source));
		const group = getProjectGroups(parseProjectSource(saved))[0];
		expect(group.entries).toEqual(['foo', 'bar']);
		expect(group.execution).toEqual([]);
		expect(saved).toContain('group idle\nentry foo\nentryEnd\nentry bar\nentryEnd\ngroupEnd');
	});

	it('accepts functionEnd with type suffix', () => {
		expect(() =>
			serializeProjectTo8f4e(createProject({ functions: [{ id: 1, code: validFunctionBlock }] }))
		).not.toThrow();
	});

	it('throws on missing opener', () => {
		expect(() =>
			serializeProjectTo8f4e(createProject({ unknown: [{ id: 1, code: ['unknownToken', 'moduleEnd'] }] }))
		).toThrow('unknown or missing opener');
	});

	it('throws on missing closer', () => {
		expect(() =>
			serializeProjectTo8f4e(createProject({ unknown: [{ id: 1, code: ['module foo', 'some code'] }] }))
		).toThrow('unknown or missing closer');
	});

	it('throws on opener/closer mismatch', () => {
		expect(() =>
			serializeProjectTo8f4e(createProject({ unknown: [{ id: 1, code: ['module foo', 'functionEnd'] }] }))
		).toThrow('opener/closer mismatch');
	});

	it('throws on mixed block type markers', () => {
		expect(() =>
			serializeProjectTo8f4e(
				createProject({ unknown: [{ id: 1, code: ['module foo', 'function bar', 'functionEnd', 'moduleEnd'] }] })
			)
		).toThrow('mixed block type markers');
	});

	it('throws on closer not at end of block', () => {
		expect(() =>
			serializeProjectTo8f4e(
				createProject({ unknown: [{ id: 1, code: ['module foo', 'moduleEnd', 'extra line', 'moduleEnd'] }] })
			)
		).toThrow('not at the end of the block');
	});

	it('ignores trailing empty lines when finding closer', () => {
		expect(() =>
			serializeProjectTo8f4e(
				createProject({
					execution: [{ type: 'module', id: 1, code: ['module foo', 'moduleEnd', '', ''], entry: 'main' }],
				})
			)
		).not.toThrow();
	});
});

describe('group template serialization', () => {
	const expanded = (name: string, value: number) =>
		`group ${name}\n; @pos ${value} 0\nexpose value &processor:value\ninit &value ${value}\npass env\nentry empty\nentryEnd\nentry main\nmodule processor\n; @pos 10 20\nint value ${value}\nmoduleEnd\nentryEnd\ngroupEnd`;
	function mark(project: ProjectObjectModel) {
		for (const group of getProjectGroups(project)) group.code.splice(1, 0, 'useTemplate voice');
		return project;
	}

	it('creates a template from existing marked groups, silently choosing the last serialized instance', () => {
		const project = mark(
			parseProjectSource(`8f4e/v1\nentry main\n${expanded('left', 1)}\n${expanded('right', 2)}\nentryEnd`)
		);
		const before = structuredClone(project);
		const saved = serializeProjectTo8f4e(project);
		expect(saved.match(/^template voice$/gm)).toHaveLength(1);
		expect(saved.match(/^module processor$/gm)).toHaveLength(1);
		expect(saved.match(/^useTemplate voice$/gm)).toHaveLength(2);
		const [left, right] = getProjectGroups(parseProjectSource(saved));
		for (const group of [left, right]) {
			expect(group.entries).toEqual(['main', 'empty']);
			expect(getProjectModules(group)[0].code).toContain('int value 2');
			expect(getProjectModules(group)[0].code).toContain('; @pos 10 20');
			expect(group.code).toContain('pass env');
		}
		expect(left.code).toContain('init &value 1');
		expect(right.code).toContain('init &value 2');
		expect(project).toEqual(before);
		expect(serializeProjectTo8f4e(parseProjectSource(saved))).toBe(saved);
		project.execution.reverse();
		expect(
			getProjectModules(getProjectGroups(parseProjectSource(serializeProjectTo8f4e(project)))[0])[0].code
		).toContain('int value 1');
	});

	it('keeps nested definitions local when extracting a shared outer template', () => {
		const source = `8f4e/v1\ntemplate outer\ntemplate inner\nentry main\nmodule x\nint value 7\nmoduleEnd\nentryEnd\ntemplateEnd\nentry main\ngroup nested\nuseTemplate inner\ngroupEnd\nentryEnd\ntemplateEnd\nentry main\ngroup a\nuseTemplate outer\ngroupEnd\ngroup b\nuseTemplate outer\ngroupEnd\nentryEnd`;
		const saved = serializeProjectTo8f4e(parseProjectSource(source));
		expect(saved.match(/^template inner$/gm)).toHaveLength(1);
		expect(saved.indexOf('template inner')).toBeGreaterThan(saved.indexOf('template outer'));
		expect(saved.indexOf('template inner')).toBeLessThan(saved.indexOf('useTemplate inner'));
		for (const outer of getProjectGroups(parseProjectSource(saved)))
			expect(getProjectModules(getProjectGroups(outer)[0])[0].code).toContain('int value 7');
		expect(serializeProjectTo8f4e(parseProjectSource(saved))).toBe(saved);
	});

	it('retains document blocks and arbitrary note examples inside a shared template', () => {
		const source = `8f4e/v1
template voice
function helper
functionEnd
includes
includesEnd
constants settings
const GAIN 2
constantsEnd
prototype state
int value
prototypeEnd
note
useTemplate example
template example
entry main
group example
noteEnd
entry empty
entryEnd
templateEnd
entry main
group instance
useTemplate voice
groupEnd
entryEnd`;
		const saved = serializeProjectTo8f4e(parseProjectSource(source));
		const group = getProjectGroups(parseProjectSource(saved))[0];
		expect(group.functions).toHaveLength(1);
		expect(group.constants).toHaveLength(1);
		expect(group.prototypes).toHaveLength(1);
		expect(group.includes).toHaveLength(1);
		expect(group.notes[0].code).toContain('template example');
		expect(group.entries).toEqual(['empty']);
		expect(serializeProjectTo8f4e(parseProjectSource(saved))).toBe(saved);
	});

	it('removes definitions that have no instances', () => {
		expect(
			serializeProjectTo8f4e(parseProjectSource('8f4e/v1\ntemplate unused\nentry main\nentryEnd\ntemplateEnd'))
		).toBe('8f4e/v1\n\n');
	});
});

it('serializes identically named local templates independently in sibling scopes', () => {
	const scope = (name: string, value: number) => `group ${name}
template local
entry main
module value
int out ${value}
moduleEnd
entryEnd
templateEnd
entry main
group child
useTemplate local
groupEnd
entryEnd
groupEnd`;
	const saved = serializeProjectTo8f4e(
		parseProjectSource(`8f4e/v1\nentry main\n${scope('a', 11)}\n${scope('b', 22)}\nentryEnd`)
	);
	expect(saved.match(/^template local$/gm)).toHaveLength(2);
	const [a, b] = getProjectGroups(parseProjectSource(saved)).map(
		group => getProjectModules(getProjectGroups(group)[0])[0]
	);
	expect(a.code).toContain('int out 11');
	expect(b.code).toContain('int out 22');
	expect(serializeProjectTo8f4e(parseProjectSource(saved))).toBe(saved);
});

it('rejects an early noteEnd while preserving other block examples in notes', () => {
	expect(() =>
		serializeProjectTo8f4e(
			createProject({ notes: [{ id: 1, code: ['note', 'entry main', 'groupEnd', 'entryEnd', 'noteEnd'] }] })
		)
	).not.toThrow();
	expect(() =>
		serializeProjectTo8f4e(createProject({ notes: [{ id: 1, code: ['note', 'noteEnd', 'extra text', 'noteEnd'] }] }))
	).toThrow('not at the end of the block');
});
