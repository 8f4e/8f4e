import type { CodeBlockGraphicData, ProjectLevel } from '@8f4e/editor-state-types';
import { getProjectGroups, getProjectModules } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { createMockCodeBlock } from '~/pureHelpers/testingUtils/testUtils';
import serializeProjectLevel from './serializeProjectLevel';

describe('serializeProjectLevel', () => {
	it('preserves detached empty entry definitions and excludes runtime level data', () => {
		const child: ProjectLevel = {
			path: 'worker',
			entries: ['foo', 'bar'],
			blocks: [],
			viewport: { x: 32, y: 64 },
		};
		const level: ProjectLevel = {
			path: '',
			entries: ['main', 'rootEmpty'],
			viewport: { x: 128, y: 256 },
			blocks: [
				createMockCodeBlock({ name: 'worker', entry: 'main', code: ['group worker', 'groupEnd'], childProject: child }),
			],
		};
		const saved = serializeProjectLevel(level);
		const savedChild = getProjectGroups(saved)[0];
		level.entries.push('later');
		child.entries.push('later');
		expect(saved.entries).toEqual(['main', 'rootEmpty']);
		expect(savedChild.entries).toEqual(['foo', 'bar']);
		expect(savedChild.execution).toEqual([]);
		saved.entries.push('savedOnly');
		savedChild.entries.push('savedOnly');
		expect(level.entries).toEqual(['main', 'rootEmpty', 'later']);
		expect(child.entries).toEqual(['foo', 'bar', 'later']);
		for (const project of [saved, savedChild]) {
			expect(project).not.toHaveProperty('path');
			expect(project).not.toHaveProperty('viewport');
		}
	});

	it('stores the editable root project-scope block as project code', () => {
		const result = serializeProjectLevel({
			path: '',
			entries: [],
			blocks: [
				createMockCodeBlock({
					code: ['pass env'],
					isProjectScope: true,
					creationIndex: 1,
				}),
			],
		});

		expect(result.code).toEqual(['pass env']);
		expect(result.unknown).toEqual([]);
	});

	it('places editor blocks in their canonical collections', () => {
		const result = serializeProjectLevel({
			path: '',
			entries: [],
			blocks: [
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
			],
		});

		expect(result.functions).toEqual([{ id: 1, code: ['function first', 'functionEnd'] }]);
		expect(getProjectModules(result)).toEqual([
			{ type: 'module', id: 2, code: ['module second', 'moduleEnd'], entry: 'main' },
		]);
	});

	it('sorts code blocks by grid position before mapping', () => {
		const blocks: CodeBlockGraphicData[] = [
			createMockCodeBlock({ name: 'a', code: ['line 1'], gridX: 20, gridY: 0 }),
			createMockCodeBlock({ name: 'b', code: ['line 2'], gridX: 0, gridY: 10 }),
			createMockCodeBlock({ name: 'c', code: ['line 3'], gridX: 0, gridY: 0 }),
		];

		const result = serializeProjectLevel({ path: '', entries: [], blocks: blocks });

		expect(result.unknown.map(block => block.code[0])).toEqual(['line 3', 'line 2', 'line 1']);
	});

	it('stores explicit disabled state when a block is disabled', () => {
		const blocks: CodeBlockGraphicData[] = [createMockCodeBlock({ name: 'disabled', code: ['code'], disabled: true })];

		const result = serializeProjectLevel({ path: '', entries: [], blocks: blocks });

		expect(result.unknown[0].disabled).toBe(true);
		expect(result.unknown[0].code).toEqual(['code']);
	});

	it('does not include disabled field when block is not disabled', () => {
		const blocks: CodeBlockGraphicData[] = [createMockCodeBlock({ name: 'enabled', code: ['code'], disabled: false })];

		const result = serializeProjectLevel({ path: '', entries: [], blocks: blocks });

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

		const result = serializeProjectLevel({ path: '', entries: [], blocks: blocks });

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

		const result = serializeProjectLevel({ path: '', entries: [], blocks: blocks });

		expect(getProjectModules(result)).toEqual([
			{ type: 'module', id: 1, code: ['module main', 'moduleEnd'], entry: 'main' },
			{ type: 'module', id: 2, code: ['module entry', 'moduleEnd'], entry: 'entry1' },
		]);
	});

	it('reconstructs recursively owned projects from nested project code-block slices', () => {
		const result = serializeProjectLevel({
			path: '',
			entries: [],
			blocks: [
				createMockCodeBlock({
					name: 'Audio',
					entry: 'main',
					code: ['group Audio', '; keep this comment', 'expose level &voice:level', 'groupEnd'],
					childProject: {
						entries: [],
						path: '',
						blocks: [
							createMockCodeBlock({
								name: 'Oscillator',
								entry: 'main',
								code: ['group Oscillator', 'groupEnd'],
								childProject: {
									entries: [],
									path: '',
									blocks: [
										createMockCodeBlock({
											creationIndex: 1,
											blockType: 'module',
											entry: 'main',
											code: ['module voice', 'moduleEnd'],
										}),
									],
								},
							}),
						],
					},
				}),
			],
		});

		expect(getProjectGroups(result)[0]).toMatchObject({
			entries: ['main'],
			entry: 'main',
			name: 'Audio',

			code: ['group Audio', '; keep this comment', 'expose level &voice:level', 'groupEnd'],
			exposures: [
				{
					name: 'level',
					targetModuleName: 'voice',
					targetMemoryName: 'level',
				},
			],
			execution: [
				{
					entry: 'main',
					entries: ['main'],
					id: 0,
					type: 'group',
					name: 'Oscillator',

					execution: [{ type: 'module', id: 1, entry: 'main', code: ['module voice', 'moduleEnd'] }],
				},
			],
		});
	});

	it('preserves empty nested projects represented by project-group blocks', () => {
		const result = serializeProjectLevel({
			path: '',
			entries: [],
			blocks: [
				createMockCodeBlock({
					name: 'Empty',
					entry: 'main',
					code: ['group Empty', 'groupEnd'],
					childProject: { entries: [], path: '', blocks: [] },
				}),
			],
		});

		expect(getProjectGroups(result)).toEqual([
			{
				entry: 'main',
				entries: [],
				type: 'group',
				id: 0,
				name: 'Empty',

				code: ['group Empty', 'groupEnd'],
				exposures: [],
				execution: [],
				functions: [],
				constants: [],
				prototypes: [],
				includes: [],
				notes: [],
				unknown: [],
			},
		]);
	});
	it('returns independent source arrays for root scope, blocks, and nested projects', () => {
		const scope = createMockCodeBlock({ isProjectScope: true, code: ['pass env'] });
		const module = createMockCodeBlock({
			blockType: 'module',
			entry: 'main',
			code: ['module root', 'int value 1', 'moduleEnd'],
		});
		const child = createMockCodeBlock({
			blockType: 'module',
			entry: 'main',
			code: ['module child', 'int value 2', 'moduleEnd'],
		});
		const group = createMockCodeBlock({
			name: 'voice',
			entry: 'main',
			code: ['group voice', 'groupEnd'],
			childProject: { entries: [], path: '', blocks: [child] },
		});
		const blocks = [scope, module, group];
		const saved = serializeProjectLevel({ path: '', entries: [], blocks: blocks });
		const other = serializeProjectLevel({ path: '', entries: [], blocks: blocks });

		scope.code[0] = 'pass changed';
		module.code[1] = 'int value 3';
		group.code.splice(1, 0, '; @testDirective');
		child.code[1] = 'int value 4';
		expect(saved.code).toEqual(['pass env']);
		expect(getProjectModules(saved)[0].code).toEqual(['module root', 'int value 1', 'moduleEnd']);
		expect(getProjectGroups(saved)[0].code).toEqual(['group voice', 'groupEnd']);
		expect(getProjectModules(getProjectGroups(saved)[0])[0].code).toEqual(['module child', 'int value 2', 'moduleEnd']);

		saved.code[0] = 'pass saved';
		getProjectModules(saved)[0].code[1] = 'int value 5';
		getProjectGroups(saved)[0].code.splice(1, 0, '; @pos 5 6');
		getProjectModules(getProjectGroups(saved)[0])[0].code[1] = 'int value 6';
		expect(scope.code).toEqual(['pass changed']);
		expect(module.code).toEqual(['module root', 'int value 3', 'moduleEnd']);
		expect(group.code).toEqual(['group voice', '; @testDirective', 'groupEnd']);
		expect(child.code).toEqual(['module child', 'int value 4', 'moduleEnd']);
		expect(other.code).toEqual(['pass env']);
		expect(getProjectModules(other)[0].code[1]).toBe('int value 1');
		expect(getProjectGroups(other)[0].code).toEqual(['group voice', 'groupEnd']);
		expect(getProjectModules(getProjectGroups(other)[0])[0].code[1]).toBe('int value 2');
	});

	it('produces identical JSON independently of live object keys and array order, including nested ties', () => {
		const first = createMockCodeBlock({
			blockType: 'module',
			entry: 'main',
			creationIndex: 1,
			gridX: 0,
			gridY: 0,
			code: ['module first', 'moduleEnd'],
		});
		const second = createMockCodeBlock({
			blockType: 'module',
			entry: 'main',
			creationIndex: 2,
			gridX: 0,
			gridY: 0,
			disabled: true,
			code: ['module second', '; @disabled', 'moduleEnd'],
		});
		const group = createMockCodeBlock({
			name: 'voice',
			entry: 'main',
			creationIndex: 3,
			gridX: 4,
			gridY: 8,
			code: ['group voice', 'expose value &first:value', 'groupEnd'],
			childProject: { entries: [], path: '', blocks: [second, first] },
		});
		const blocks = [second, group, first];
		const reorder = (block: CodeBlockGraphicData): CodeBlockGraphicData =>
			({
				...Object.fromEntries(Object.entries(block).reverse()),
				...(block.childProject === undefined
					? {}
					: { childProject: { entries: [], path: '', blocks: [...block.childProject.blocks].reverse().map(reorder) } }),
			}) as CodeBlockGraphicData;
		const original = serializeProjectLevel({ path: '', entries: [], blocks: blocks });
		const reordered = serializeProjectLevel({ path: '', entries: [], blocks: [...blocks].reverse().map(reorder) });

		expect(JSON.stringify(reordered)).toBe(JSON.stringify(original));
		expect(getProjectModules(original).map(block => block.id)).toEqual([1, 2]);
		expect(getProjectModules(getProjectGroups(original)[0]).map(block => block.id)).toEqual([1, 2]);
	});
});
