import { describe, expect, it } from 'vitest';
import { createMockCodeBlock } from '~/pureHelpers/testingUtils/testUtils';
import convertGraphicDataToProjectStructure from './serializeCodeBlocks';

describe('convertGraphicDataToProjectStructure', () => {
	it('stores the editable root project-scope block as project code', () => {
		const result = convertGraphicDataToProjectStructure([
			createMockCodeBlock({
				code: ['pass env'],
				isProjectScope: true,
				creationIndex: 1,
			}),
		]);

		expect(result.code).toEqual(['pass env']);
		expect(result.unknown).toEqual([]);
	});

	it('places editor blocks in their canonical collections', () => {
		const result = convertGraphicDataToProjectStructure([
			createMockCodeBlock({
				code: ['module second', 'moduleEnd'],
				blockType: 'module',
				creationIndex: 2,
				entry: 'main',
				gridX: 10,
				gridY: 0,
			}),
			createMockCodeBlock({
				code: ['function first', 'functionEnd'],
				blockType: 'function',
				creationIndex: 1,
				gridX: 0,
				gridY: 0,
			}),
		]);

		expect(result.functions).toEqual([{ id: 1, code: ['function first', 'functionEnd'] }]);
		expect(result.modules).toEqual([{ id: 2, code: ['module second', 'moduleEnd'], entry: 'main' }]);
	});

	it('sorts code blocks by grid position before mapping', () => {
		const blocks: CodeBlockGraphicData[] = [
			createMockCodeBlock({ name: 'a', code: ['line 1'], gridX: 20, gridY: 0 }),
			createMockCodeBlock({ name: 'b', code: ['line 2'], gridX: 0, gridY: 10 }),
			createMockCodeBlock({ name: 'c', code: ['line 3'], gridX: 0, gridY: 0 }),
		];

		const result = convertGraphicDataToProjectStructure(blocks);

		expect(result.unknown.map(block => block.code[0])).toEqual(['line 3', 'line 2', 'line 1']);
	});

	it('stores explicit disabled state when a block is disabled', () => {
		const blocks: CodeBlockGraphicData[] = [createMockCodeBlock({ name: 'disabled', code: ['code'], disabled: true })];

		const result = convertGraphicDataToProjectStructure(blocks);

		expect(result.unknown[0].disabled).toBe(true);
		expect(result.unknown[0].code).toEqual(['code']);
	});

	it('does not include disabled field when block is not disabled', () => {
		const blocks: CodeBlockGraphicData[] = [createMockCodeBlock({ name: 'enabled', code: ['code'], disabled: false })];

		const result = convertGraphicDataToProjectStructure(blocks);

		expect(result.unknown[0]).not.toHaveProperty('disabled');
		expect(result.unknown[0].code).toEqual(['code']);
	});

	it('includes all notes regardless of their names in the exported project', () => {
		const blocks: CodeBlockGraphicData[] = [
			createMockCodeBlock({
				name: 'local',
				creationIndex: 0,
				blockType: 'note',
				code: ['note local.editorConfig', '; @config font ibmvga8x16', 'noteEnd'],
			}),
			createMockCodeBlock({
				name: 'project-note',
				creationIndex: 1,
				blockType: 'note',
				code: ['note', 'project note', 'noteEnd'],
			}),
			createMockCodeBlock({
				name: 'typed-note',
				creationIndex: 2,
				blockType: 'note',
				code: ['note custom', 'Some custom note content', 'noteEnd'],
			}),
		];

		const result = convertGraphicDataToProjectStructure(blocks);

		expect(result.notes.map(block => block.code[0])).toEqual(['note local.editorConfig', 'note', 'note custom']);
	});

	it('stores module entries on module blocks', () => {
		const blocks: CodeBlockGraphicData[] = [
			createMockCodeBlock({
				name: 'main',
				creationIndex: 1,
				blockType: 'module',
				entry: 'main',
				code: ['module main', 'moduleEnd'],
			}),
			createMockCodeBlock({
				name: 'entry',
				creationIndex: 2,
				blockType: 'module',
				entry: 'entry1',
				code: ['module entry', 'moduleEnd'],
			}),
		];

		const result = convertGraphicDataToProjectStructure(blocks);

		expect(result.modules).toEqual([
			{ id: 1, code: ['module main', 'moduleEnd'], entry: 'main' },
			{ id: 2, code: ['module entry', 'moduleEnd'], entry: 'entry1' },
		]);
	});

	it('reconstructs recursively owned projects from nested project code-block slices', () => {
		const result = convertGraphicDataToProjectStructure([
			createMockCodeBlock({
				name: 'Audio',
				entry: 'main',
				code: ['group Audio', '; keep this comment', 'expose level &voice:level', 'groupEnd'],
				nestedProjectCodeBlocks: [
					createMockCodeBlock({
						name: 'Oscillator',
						entry: 'main',
						code: ['group Oscillator', 'groupEnd'],
						nestedProjectCodeBlocks: [
							createMockCodeBlock({
								creationIndex: 1,
								blockType: 'module',
								entry: 'main',
								code: ['module voice', 'moduleEnd'],
							}),
						],
					}),
				],
			}),
		]);

		expect(result.groups[0]).toMatchObject({
			name: 'Audio',
			entry: 'main',
			code: ['group Audio', '; keep this comment', 'expose level &voice:level', 'groupEnd'],
			exposures: [
				{
					name: 'level',
					targetModuleName: 'voice',
					targetMemoryName: 'level',
				},
			],
			groups: [
				{
					name: 'Oscillator',
					entry: 'main',
					modules: [{ id: 1, entry: 'main', code: ['module voice', 'moduleEnd'] }],
				},
			],
		});
	});

	it('preserves empty nested projects represented by project-group blocks', () => {
		const result = convertGraphicDataToProjectStructure([
			createMockCodeBlock({
				name: 'Empty',
				entry: 'main',
				code: ['group Empty', 'groupEnd'],
				nestedProjectCodeBlocks: [],
			}),
		]);

		expect(result.groups).toEqual([
			{
				name: 'Empty',
				entry: 'main',
				code: ['group Empty', 'groupEnd'],
				exposures: [],
				// Nested project code is represented by its group wrapper rather than a second scope block.
				modules: [],
				functions: [],
				constants: [],
				prototypes: [],
				includes: [],
				notes: [],
				unknown: [],
				groups: [],
			},
		]);
	});
});
