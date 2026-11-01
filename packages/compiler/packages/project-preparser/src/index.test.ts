import { getProjectGroups, getProjectModules } from '@8f4e/language-spec';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

import {
	BLOCK_DELIMITERS,
	FORMAT_HEADER,
	getDocumentProjectBlockType,
	getExpectedProjectCloserPrefix,
	getProjectBlockType,
	getProjectCloserKeyword,
	getProjectOpenerKeyword,
	parseProjectSource,
} from './index';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(__dirname, 'fixtures');
const snapshotDirectory = path.join(__dirname, '__snapshots__');

const validModuleBlock = ['module counter', '', 'int count', '', 'moduleEnd'];
const validFunctionBlock = ['function sine', 'param float x', 'functionEnd float'];
const validPrototypeBlock = ['prototype oscillatorState', 'float phase', 'float frequency 440', 'prototypeEnd'];
const validNoteBlock = ['note', '; @pos 2 3', 'remember to tune this later', 'noteEnd'];
const noteContentMarkers = [
	'module declarations hold state',
	'function example',
	'constants values',
	'prototype state',
	'includes',
	'note another reminder',
	'entry main',
	'group audio',
	'moduleEnd',
	'functionEnd int',
	'constantsEnd',
	'prototypeEnd',
	'includesEnd',
	'entryEnd',
	'groupEnd',
	'noteEndless prose',
	'moduleEndless prose',
];

function readProjectFixtureNames(): string[] {
	return readdirSync(fixtureDirectory, { withFileTypes: true })
		.filter(entry => entry.isFile() && entry.name.endsWith('.8f4e'))
		.map(entry => entry.name)
		.sort();
}

function readProjectFixture(name: string): string {
	return readFileSync(path.join(fixtureDirectory, name), 'utf8');
}

function getSnapshotPath(fixtureName: string, snapshotName: string): string {
	return path.join(snapshotDirectory, `${fixtureName}.${snapshotName}.snap`);
}

describe('project-preparser index', () => {
	it('parses independent group entries, including empty entries and a scope without main', () => {
		const project = parseProjectSource(`8f4e/v1
entry test
group worker
entry foo
module work
moduleEnd
entryEnd
entry bar
entryEnd
entry foo
module moreWork
moduleEnd
entryEnd
groupEnd
entryEnd`);
		const group = getProjectGroups(project)[0];
		expect(project.entries).toEqual(['test']);
		expect(group.entry).toBe('test');
		expect(group.entries).toEqual(['foo', 'bar']);
		expect(getProjectModules(group).map(block => block.entry)).toEqual(['foo', 'foo']);
	});

	it('exports the project preparser subsystem surface', () => {
		const project = parseProjectSource(
			['8f4e/v1', '', 'entry main', 'module counter', 'moduleEnd', 'entryEnd'].join('\n')
		);

		expect(FORMAT_HEADER).toBe('8f4e/v1');
		expect(BLOCK_DELIMITERS.length).toBeGreaterThan(0);
		expect(getProjectOpenerKeyword('group audio')).toBe('group');
		expect(getProjectCloserKeyword('groupEnd')).toBe('groupEnd');
		expect(getExpectedProjectCloserPrefix('entry')).toBe('entryEnd');
		expect(getDocumentProjectBlockType(getProjectModules(project)[0].code)).toBe('module');
		expect(getProjectBlockType(getProjectModules(project)[0].code)).toBe('module');
	});
});

describe('parseProjectSource', () => {
	it('parses multiple document blocks', () => {
		const text = [
			'8f4e/v1',
			'',
			'; project comment before an entry',
			'entry main',
			'; entry comment before a module',
			...validModuleBlock,
			'// entry comment before closing',
			'entryEnd',
			'',
			'# project directive-style comment before a function',
			...validFunctionBlock,
			'',
			...validPrototypeBlock,
			'',
			...validNoteBlock,
			'; trailing project comment',
		].join('\n');
		const project = parseProjectSource(text);

		expect(getProjectModules(project)).toEqual([{ type: 'module', id: 6, code: validModuleBlock, entry: 'main' }]);
		expect(project.functions).toEqual([{ id: 15, code: validFunctionBlock }]);
		expect(project.prototypes).toEqual([{ id: 19, code: validPrototypeBlock }]);
		expect(project.notes).toEqual([{ id: 24, code: validNoteBlock }]);
		expect(getProjectGroups(project)).toEqual([]);
	});

	it.each(noteContentMarkers)('preserves %s as root note content', marker => {
		const noteCode = ['  note', '; @pos 2 3', `\t${marker}  `, '', '  \t', '  noteEnd  '];
		const project = parseProjectSource(
			['8f4e/v1', '', ...noteCode, '', ...validFunctionBlock, 'entry main', ...validModuleBlock, 'entryEnd'].join('\n')
		);

		expect(project.notes).toEqual([{ id: 3, code: noteCode }]);
		expect(project.functions).toEqual([{ id: 10, code: validFunctionBlock }]);
		expect(getProjectModules(project)).toEqual([{ type: 'module', id: 14, code: validModuleBlock, entry: 'main' }]);
		expect(project.constants).toEqual([]);
		expect(project.prototypes).toEqual([]);
		expect(project.includes).toEqual([]);
		expect(getProjectGroups(project)).toEqual([]);
	});

	it('preserves note text and following blocks inside nested groups', () => {
		const noteCode = [
			'\tnote',
			'\t; @pos 2 3',
			'',
			...noteContentMarkers.map(marker => `\t${marker}  `),
			'  \t',
			'\tnoteEnd',
		];
		const project = parseProjectSource(
			[
				'8f4e/v1',
				'entry main',
				'group audio',
				'entry main',
				'group docs',
				...noteCode,
				'entry main',
				...validModuleBlock,
				'entryEnd',
				'groupEnd',
				'entryEnd',
				'groupEnd',
				'entryEnd',
			].join('\n')
		);

		expect(project.notes).toEqual([]);
		expect(getProjectGroups(project)[0].code).toEqual(['group audio', 'groupEnd']);
		expect(getProjectGroups(getProjectGroups(project)[0])[0]).toEqual({
			entry: 'main',
			entries: ['main'],
			type: 'group',
			id: 5,
			name: 'docs',

			code: ['group docs', 'groupEnd'],
			exposures: [],
			execution: [{ type: 'module', id: 7 + noteCode.length, code: validModuleBlock, entry: 'main' }],
			functions: [],
			constants: [],
			prototypes: [],
			includes: [],
			notes: [{ id: 6, code: noteCode }],
			unknown: [],
		});
	});

	it.each([
		{ name: 'root', before: ['8f4e/v1'], after: [] },
		{ name: 'group', before: ['8f4e/v1', 'entry main', 'group docs'], after: ['groupEnd', 'entryEnd'] },
	])('reports an unclosed $name note despite other block markers', ({ before, after }) => {
		expect(() => parseProjectSource([...before, 'note', ...noteContentMarkers, ...after].join('\n'))).toThrow(
			'Parse error: unclosed block with opener "note"'
		);
	});

	it('keeps top-level includes as project blocks without expanding them', () => {
		const includesBlock = ['includes', 'include std/math/clamp', 'include std/events/risingEdge', 'includesEnd'];
		const project = parseProjectSource(
			['8f4e/v1', '', ...includesBlock, '', 'entry main', ...validModuleBlock, 'entryEnd'].join('\n')
		);

		expect(project.includes).toEqual([{ id: 3, code: includesBlock }]);
		expect(getProjectModules(project)).toEqual([{ type: 'module', id: 9, code: validModuleBlock, entry: 'main' }]);
	});

	it('parses module blocks that contain shape instructions', () => {
		const project = parseProjectSource(
			['8f4e/v1', '', 'entry main', 'module oscillator', 'shape oscillatorState', 'moduleEnd', 'entryEnd'].join('\n')
		);

		expect(getProjectModules(project)[0]).toEqual({
			type: 'module',
			id: 4,
			code: ['module oscillator', 'shape oscillatorState', 'moduleEnd'],
			entry: 'main',
		});
	});

	it('allows empty entries', () => {
		const project = parseProjectSource(['8f4e/v1', '', 'entry main', 'entryEnd'].join('\n'));

		expect(getProjectModules(project)).toEqual([]);
		expect(getProjectGroups(project)).toEqual([]);
	});

	it('parses empty files with only a header', () => {
		expect(getProjectModules(parseProjectSource('8f4e/v1\n'))).toEqual([]);
		expect(getProjectGroups(parseProjectSource('8f4e/v1\n'))).toEqual([]);
	});

	it('parses nested groups under entries', () => {
		const project = parseProjectSource(
			[
				'8f4e/v1',
				'',
				'entry main',
				'group audio',
				'entry main',
				...validModuleBlock,
				'entryEnd',
				...validFunctionBlock,
				'entry main',
				'group oscillator',
				...validPrototypeBlock,
				...validNoteBlock,
				'groupEnd',
				'entryEnd',
				'groupEnd',
				'entryEnd',
			].join('\n')
		);

		expect(getProjectModules(project)).toEqual([]);
		expect(project.functions).toEqual([]);
		expect(project.prototypes).toEqual([]);
		expect(project.notes).toEqual([]);
		expect(getProjectGroups(project)).toEqual([
			{
				entry: 'main',
				entries: ['main'],
				type: 'group',
				id: 4,
				name: 'audio',

				code: ['group audio', 'groupEnd'],
				exposures: [],
				execution: [
					{ type: 'module', id: 6, code: validModuleBlock, entry: 'main' },
					{
						entry: 'main',
						entries: [],
						id: 16,
						type: 'group',
						name: 'oscillator',

						code: ['group oscillator', 'groupEnd'],
						exposures: [],
						execution: [],
						functions: [],
						constants: [],
						prototypes: [{ id: 17, code: validPrototypeBlock }],
						includes: [],
						notes: [{ id: 21, code: validNoteBlock }],
						unknown: [],
					},
				],
				functions: [{ id: 12, code: validFunctionBlock }],
				constants: [],
				prototypes: [],
				includes: [],
				notes: [],
				unknown: [],
			},
		]);
	});

	it('preserves every group-root source line while extracting nested blocks', () => {
		const groupCode = [
			'group audio',
			'; this comment belongs to the group block',
			'futureInstruction anything',
			'expose level &voice:level',
			'',
			'groupEnd',
		];
		const project = parseProjectSource(
			[
				'8f4e/v1',
				'entry main',
				...groupCode.slice(0, -1),
				'entry main',
				...validModuleBlock,
				'entryEnd',
				groupCode.at(-1)!,
				'entryEnd',
			].join('\n')
		);

		expect(getProjectGroups(project)[0].code).toEqual(groupCode);
		expect(getProjectModules(getProjectGroups(project)[0])).toEqual([
			{ type: 'module', id: 9, code: validModuleBlock, entry: 'main' },
		]);
		expect(getProjectGroups(project)[0].exposures).toEqual([
			{
				name: 'level',
				targetModuleName: 'voice',
				targetMemoryName: 'level',
			},
		]);
	});

	it('throws on invalid project shape', () => {
		expect(() => parseProjectSource('wrong-header\nmodule foo\nmoduleEnd')).toThrow('Invalid .8f4e file');
		expect(() => parseProjectSource('8f4e/v1\n\nentry main\nmodule foo\nsome code')).toThrow('unclosed block');
		expect(() => parseProjectSource('8f4e/v1\n\nentry main\nmodule foo\nfunctionEnd')).toThrow('does not match opener');
		expect(() => parseProjectSource('8f4e/v1\n\nunexpectedContent')).toThrow('expected opener keyword');
		expect(() => parseProjectSource('8f4e/v1\n\nmodule foo\nmoduleEnd')).toThrow(
			'module blocks must be inside an entry block'
		);
		expect(() =>
			parseProjectSource('8f4e/v1\n\nentry main\nmodule foo\nfunction bar\nfunctionEnd\nmoduleEnd\nentryEnd')
		).toThrow('mixed block type markers');
		expect(() => parseProjectSource('8f4e/v1\n\nentry main\nfunction foo\nfunctionEnd\nentryEnd')).toThrow(
			'can only contain module or group blocks'
		);
		expect(parseProjectSource('8f4e/v1\nentry main\nentryEnd\nentry main\nentryEnd').entries).toEqual(['main']);
		expect(() =>
			parseProjectSource('8f4e/v1\n\nentry main\ngroup audio\ngroupEnd\ngroup audio\ngroupEnd\nentryEnd')
		).toThrow('duplicate sibling group "audio"');

		expect(() => parseProjectSource('8f4e/v1\n\nentry main\ngroup\ngroupEnd\nentryEnd')).toThrow(
			'group requires exactly one name'
		);
		expect(() => parseProjectSource('8f4e/v1\n\nentry main\ngroup invalid/name\ngroupEnd\nentryEnd')).toThrow(
			'invalid group name'
		);

		expect(() => parseProjectSource('8f4e/v1\n\nentry main\ngroup audio\nmoduleEnd\ngroupEnd\nentryEnd')).toThrow(
			'unexpected closer "moduleEnd"'
		);
		expect(() => parseProjectSource('8f4e/v1\n\nentry main\nincludes\nincludesEnd\nentryEnd')).toThrow(
			'can only contain module or group blocks'
		);
	});

	it('rejects duplicate exposure names within a group', () => {
		expect(() =>
			parseProjectSource(
				[
					'8f4e/v1',
					'entry main',
					'group audio',
					'expose value &source:first',
					'expose value &source:second',
					'groupEnd',
					'entryEnd',
				].join('\n')
			)
		).toThrow('duplicate exposure "value"');
	});
});

describe('parseProjectSource fixtures', () => {
	const fixtureNames = readProjectFixtureNames();

	it('has project fixtures', () => {
		expect(fixtureNames.length).toBeGreaterThan(0);
	});

	it.each(fixtureNames)('matches parser snapshots for %s', async fixtureName => {
		const project = parseProjectSource(readProjectFixture(fixtureName));

		await expect(project).toMatchFileSnapshot(getSnapshotPath(fixtureName, 'project'));
	});
});
