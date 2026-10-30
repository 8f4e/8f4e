import { describe, expect, it } from 'vitest';
import getBlockType from '../../code-blocks/utils/codeParsers/getBlockType';
import getCodeBlockNameFromSource from '../../code-blocks/utils/getCodeBlockNameFromSource';
import { parseBlockDirectives } from '../../code-blocks/utils/parseBlockDirectives';
import { resolveGlobalEditorDirectives } from '../registry';

function createParsedBlock(code: string[], name?: string, projectPath = '') {
	return {
		projectPath,
		creationIndex: 0,
		parsedDirectives: parseBlockDirectives(code),
		name: name ?? getCodeBlockNameFromSource(code),
		blockType: getBlockType(code),
	};
}

describe('@config directive', () => {
	it('records config entries for validation and resolution', () => {
		const result = resolveGlobalEditorDirectives([
			createParsedBlock([
				'module a',
				'; @config font 6x10',
				'; @config color.ink #112233',
				'; @config color.primary #010203',
				'moduleEnd',
			]),
		]);

		expect(result.resolved.configEntries).toEqual([
			{ path: 'font', value: '6x10', sourceLineIndex: 1, codeBlockId: 0, moduleId: 'a' },
			{ path: 'color.ink', value: '#112233', sourceLineIndex: 2, codeBlockId: 0, moduleId: 'a' },
			{ path: 'color.primary', value: '#010203', sourceLineIndex: 3, codeBlockId: 0, moduleId: 'a' },
		]);
		expect(result.errors).toEqual([]);
	});

	it('records config entries with dash continuation arguments', () => {
		const result = resolveGlobalEditorDirectives([
			createParsedBlock(['module a', '; @config', '; - settings.target', '; - frame:buffer', 'moduleEnd']),
		]);

		expect(result.resolved.configEntries).toEqual([
			{ path: 'settings.target', value: 'frame:buffer', sourceLineIndex: 1, codeBlockId: 0, moduleId: 'a' },
		]);
		expect(result.errors).toEqual([]);
	});

	it('records the current module for config entries', () => {
		const result = resolveGlobalEditorDirectives([
			createParsedBlock(['module example', '; @config custom.target buffer', 'moduleEnd'], 'example', 'outer'),
		]);

		expect(result.resolved.configEntries).toEqual([
			{
				path: 'custom.target',
				value: 'buffer',
				sourceLineIndex: 1,
				codeBlockId: 0,
				moduleId: 'outer/example',
			},
		]);
		expect(result.errors).toEqual([]);
	});

	it('lets validators handle path-specific meaning', () => {
		const result = resolveGlobalEditorDirectives([
			createParsedBlock([
				'module a',
				'; @config font tiny',
				'; @config blockScale 4',
				'; @config color.ink ???',
				'moduleEnd',
			]),
		]);

		expect(result.resolved.configEntries).toEqual([
			{ path: 'font', value: 'tiny', sourceLineIndex: 1, codeBlockId: 0, moduleId: 'a' },
			{ path: 'blockScale', value: '4', sourceLineIndex: 2, codeBlockId: 0, moduleId: 'a' },
			{ path: 'color.ink', value: '???', sourceLineIndex: 3, codeBlockId: 0, moduleId: 'a' },
		]);
		expect(result.errors).toEqual([]);
	});

	it('requires exactly a path and value', () => {
		const result = resolveGlobalEditorDirectives([
			createParsedBlock(['module a', '; @config', '; @config font', '; @config font ibmvga8x16 extra', 'moduleEnd']),
		]);

		expect(result.resolved).toEqual({});
		expect(result.errors).toHaveLength(3);
		expect(result.errors.every(error => error.message.includes('requires exactly 2 arguments'))).toBe(true);
	});
});
