import { getProjectGroups, getProjectModules } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import serializeToProject from './serializeToProject';

describe('serializeToProject', () => {
	it('serializes basic project state without compiled data', () => {
		const rootCodeBlocks = [
			createMockCodeBlock({
				name: 'block-1',
				code: ['10 example'],
				x: 20,
				y: 30,
			}),
		];
		const state = createMockState({
			codeBlockRendering: {
				rootProject: { entries: [], path: '', blocks: rootCodeBlocks },
				currentProject: { entries: [], path: '', blocks: rootCodeBlocks },
			},
			envConstantContributions: {},
			viewport: {
				x: 40,
				y: 50,
				vGrid: 10,
				hGrid: 10,
			},
		});

		const project = serializeToProject(state);

		expect(project).toMatchSnapshot();
	});

	it('derives serialized project data from current code blocks', () => {
		const rootCodeBlocks = [
			createMockCodeBlock({
				name: 'includes',
				blockType: 'includes',
				code: ['includes', 'include std/current', 'includesEnd'],
				x: 0,
				y: 0,
			}),
		];
		const state = createMockState({
			codeBlockRendering: {
				rootProject: { entries: [], path: '', blocks: rootCodeBlocks },
				currentProject: { entries: [], path: '', blocks: rootCodeBlocks },
			},
		});

		expect(serializeToProject(state)).toEqual({
			entries: [],
			code: [],
			execution: [],
			functions: [],
			constants: [],
			prototypes: [],
			includes: [
				expect.objectContaining({
					code: ['includes', 'include std/current', 'includesEnd'],
				}),
			],
			notes: [],
			unknown: [],
		});
	});

	it('serializes the recursive root tree instead of only the rendered nested slice', () => {
		const nestedProjectCodeBlocks = [
			createMockCodeBlock({
				name: 'voice',
				blockType: 'module',
				entry: 'main',
				creationIndex: 2,
				code: ['module voice', 'moduleEnd'],
			}),
		];
		const rootCodeBlocks = [
			createMockCodeBlock({
				name: 'root',
				blockType: 'module',
				entry: 'main',
				creationIndex: 1,
				code: ['module root', 'moduleEnd'],
			}),
			createMockCodeBlock({
				name: 'Audio',
				entry: 'main',
				code: ['group Audio', 'groupEnd'],
				childProject: { entries: [], path: '', blocks: nestedProjectCodeBlocks },
			}),
		];
		const state = createMockState({
			codeBlockRendering: {
				rootProject: { entries: [], path: '', blocks: rootCodeBlocks },
				currentProject: { entries: [], path: '', blocks: nestedProjectCodeBlocks },
			},
		});

		const project = serializeToProject(state);

		expect(getProjectModules(project).map(block => block.code[0])).toEqual(['module root']);
		expect(getProjectModules(getProjectGroups(project)[0]).map(block => block.code[0])).toEqual(['module voice']);
	});
});
