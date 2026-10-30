import { parseProjectSource } from '@8f4e/compiler';
import type { ProjectGroupObjectModel, ProjectObjectModel } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { serializeProjectTo8f4e } from './serializeTo8f4e';

const validBlock = ['module counter', '', 'int count', '', 'moduleEnd'];
const validFunctionBlock = ['function sine', 'param float x', 'functionEnd float'];
const validNoteBlock = ['note', '; @pos 1 2', 'compiler should ignore this', 'noteEnd'];

function createProject(partial: Partial<ProjectObjectModel> = {}): ProjectObjectModel {
	return {
		code: [],
		modules: [],
		functions: [],
		constants: [],
		prototypes: [],
		includes: [],
		notes: [],
		unknown: [],
		groups: [],
		...partial,
	};
}

function createGroup(partial: Partial<ProjectGroupObjectModel>): ProjectGroupObjectModel {
	return { ...createProject(), name: 'group', entry: 'main', exposures: [], ...partial };
}

describe('serializeProjectTo8f4e', () => {
	it('produces 8f4e/v1 header', () => {
		const result = serializeProjectTo8f4e(createProject({ modules: [{ id: 1, code: validBlock, entry: 'main' }] }));
		expect(result.startsWith('8f4e/v1\n')).toBe(true);
	});

	it('serializes multiple block collections separated by blank lines', () => {
		const project = createProject({
			modules: [{ id: 1, code: validBlock, entry: 'main' }],
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
			modules: [{ id: 2, code: validBlock, entry: 'main' }],
		});
		expect(serializeProjectTo8f4e(project)).toBe(
			['8f4e/v1', '', ...visibleIncludesBlock, '', 'entry main', ...validBlock, 'entryEnd'].join('\n')
		);
	});

	it('preserves module order within each entry', () => {
		const project = createProject({
			modules: [
				{ id: 1, code: ['module a', 'moduleEnd'], entry: 'main' },
				{ id: 3, code: ['module b', 'moduleEnd'], entry: 'test' },
				{ id: 4, code: ['module c', 'moduleEnd'], entry: 'main' },
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
				'module c',
				'moduleEnd',
				'entryEnd',
				'',
				'entry test',
				'module b',
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
			modules: [{ id: 1, code: validBlock, entry: 'main' }],
			functions: [{ id: 2, code: validFunctionBlock }],
			notes: [{ id: 3, code: validNoteBlock }],
		});

		const parsed = parseProjectSource(serializeProjectTo8f4e(project));

		expect(parsed.modules[0].code).toEqual(validBlock);
		expect(parsed.functions[0].code).toEqual(validFunctionBlock);
		expect(parsed.notes[0].code).toEqual(validNoteBlock);
	});

	it('round-trips recursively owned groups', () => {
		const project = createGroup({
			groups: [
				createGroup({
					name: 'audio',
					entry: 'main',
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
							targetModuleName: 'counter',
							targetMemoryName: 'count',
						},
					],
					modules: [{ id: 1, code: validBlock, entry: 'main' }],
					functions: [{ id: 2, code: validFunctionBlock }],
					groups: [
						createGroup({
							name: 'notes',
							entry: 'main',
							code: ['group notes', 'groupEnd'],
							exposures: [],
							notes: [{ id: 3, code: validNoteBlock }],
						}),
					],
				}),
			],
		});

		const parsed = parseProjectSource(serializeProjectTo8f4e(project));

		expect(parsed.groups[0]).toMatchObject({
			name: 'audio',
			entry: 'main',
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
					targetModuleName: 'counter',
					targetMemoryName: 'count',
				},
			],
			modules: [{ code: validBlock, entry: 'main' }],
			functions: [{ code: validFunctionBlock }],
			groups: [{ name: 'notes', entry: 'main', notes: [{ code: validNoteBlock }] }],
		});
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
				createProject({ modules: [{ id: 1, code: ['module foo', 'moduleEnd', '', ''], entry: 'main' }] })
			)
		).not.toThrow();
	});
});
