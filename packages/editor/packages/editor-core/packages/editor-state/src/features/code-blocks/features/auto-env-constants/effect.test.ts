import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import { getProjectModules } from '@8f4e/language-spec';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, test } from 'vitest';
import { EMPTY_DEFAULT_PROJECT } from '~/features/project-loading/emptyDefaultProject';
import createDefaultState from '~/pureHelpers/state/createDefaultState';
import { createMockCodeBlock, createMockEventDispatcher } from '~/pureHelpers/testingUtils/testUtils';
import codeBlockRendering from '../../effect';
import { createLayoutRegistry } from '../../layout/registry';
import { directiveDefinitions } from '../directives/registry';
import autoEnvConstants from './effect';

const AUTO_ENV_BLOCK_NAME = 'env';
const PROJECT_WITH_CODE_BLOCK: ProjectObjectModel = {
	...EMPTY_DEFAULT_PROJECT,
	execution: [{ type: 'module', id: 0, code: ['module demo', 'moduleEnd'], entry: 'main' }],
};

function createGraphicEnvBlock(code: string[], overrides: Partial<CodeBlockGraphicData> = {}): CodeBlockGraphicData {
	return createMockCodeBlock({
		name: AUTO_ENV_BLOCK_NAME,
		code,
		creationIndex: 0,
		blockType: 'constants',
		width: 0,
		height: 0,
		gridX: 0,
		gridY: 0,
		lineNumberColumnWidth: 2,
		...overrides,
	});
}

describe('autoEnvConstants', () => {
	let store: ReturnType<typeof createStateManager<State>>;
	let state: State;

	beforeEach(() => {
		const baseState = {
			...createDefaultState(),
			envConstantContributions: { provider: ['const PROVIDED 50'] },
			initialProjectState: {
				...EMPTY_DEFAULT_PROJECT,
			},
		};
		store = createStateManager<State>(baseState);
		state = store.getState();
		codeBlockRendering(
			store,
			createMockEventDispatcher(),
			directiveDefinitions,
			createLayoutRegistry(() => {})
		);
	});

	test('should create env constants block when project is loaded', () => {
		autoEnvConstants(store);

		// Trigger project load
		store.set('initialProjectState', { ...EMPTY_DEFAULT_PROJECT });

		const envBlock = state.initialProjectState?.constants.find(block => block.code[0]?.includes('constants env'));
		expect(envBlock).toBeDefined();
		expect(envBlock?.code[0]).toBe('constants env');
	});

	test('should place env block at beginning of codeBlocks array', () => {
		const projectWithBlocks: ProjectObjectModel = {
			...EMPTY_DEFAULT_PROJECT,
			execution: [{ type: 'module', id: 0, code: ['module test', 'moduleEnd'], entry: 'main' }],
		};

		store.set('initialProjectState', projectWithBlocks);
		autoEnvConstants(store);

		// Trigger another project load to add env block
		store.set('initialProjectState', { ...projectWithBlocks });

		expect(state.initialProjectState?.constants[0].code[0]).toBe('constants env');
		expect(getProjectModules(state.initialProjectState)[0].code[0]).toBe('module test');
	});

	test('includes contributed constants when a project is loaded', () => {
		autoEnvConstants(store);
		store.set('envConstantContributions.provider', ['const PROVIDED 123']);
		store.set('initialProjectState', { ...PROJECT_WITH_CODE_BLOCK });
		const env = state.initialProjectState?.constants.find(block => block.code[0] === 'constants env');
		expect(env?.code).toContain('const PROVIDED 123');
	});

	test('should include warning comment', () => {
		autoEnvConstants(store);
		store.set('initialProjectState', { ...EMPTY_DEFAULT_PROJECT });

		const envBlock = state.initialProjectState?.constants.find(block => block.code[0]?.includes('constants env'));
		const warningLine = envBlock?.code.find(line => line.includes('Auto-generated'));
		expect(warningLine).toBeDefined();
	});

	test('should update when contributed constants change', () => {
		autoEnvConstants(store);
		store.set('initialProjectState', { ...EMPTY_DEFAULT_PROJECT });

		// Simulate codeBlockRendering populating codeBlocks from initialProjectState.
		const envSource = state.initialProjectState!.constants.find(block => block.code[0] === 'constants env')!;
		store.set('codeBlockRendering.codeBlocks', [createGraphicEnvBlock(envSource.code)]);
		store.set('envConstantContributions.provider', ['const PROVIDED 77']);
		expect(state.codeBlockRendering.codeBlocks[0].code.filter(line => line.startsWith('const '))).toEqual([
			'const PROVIDED 77',
		]);
	});

	test('includes contributed source from multiple providers when creating env', () => {
		autoEnvConstants(store);
		store.set('envConstantContributions', {
			first: ['const FIRST 1'],
			provider: state.envConstantContributions.provider,
			empty: [],
			second: ['; second provider', 'const SECOND 2'],
		});
		store.set('initialProjectState', { ...EMPTY_DEFAULT_PROJECT });
		const env = state.initialProjectState?.constants.find(block => block.code[0] === 'constants env');
		expect(env?.code).toEqual(
			expect.arrayContaining(['const PROVIDED 50', 'const FIRST 1', '; second provider', 'const SECOND 2'])
		);
		expect(env?.code.filter(line => line.startsWith('const '))).toEqual([
			'const FIRST 1',
			'const PROVIDED 50',
			'const SECOND 2',
		]);
	});

	test('refreshes contributed constants and removes contributions without changing the env position', () => {
		autoEnvConstants(store);
		store.set('codeBlockRendering.codeBlocks', [
			createGraphicEnvBlock(['constants env', '; @pos 7 9', 'constantsEnd']),
		]);
		store.set('envConstantContributions.example', ['const PROVIDED 42']);
		const env = state.codeBlockRendering.codeBlocks[0];
		expect(env.code).toContain('const PROVIDED 42');
		expect(env.code).toContain('; @pos 7 9');
		store.set('envConstantContributions', { provider: state.envConstantContributions.provider });
		expect(env.code).not.toContain('const PROVIDED 42');
		expect(env.code).toContain('; @pos 7 9');
	});

	test('should preserve existing @pos when regenerating env block', () => {
		autoEnvConstants(store);
		store.set('initialProjectState', { ...EMPTY_DEFAULT_PROJECT });

		const envCodeBlock = state.initialProjectState!.constants.find(block => block.code[0] === 'constants env')!;
		const codeWithCustomPos = [...envCodeBlock.code];
		codeWithCustomPos[1] = '; @pos 12 -7';
		store.set('codeBlockRendering.codeBlocks', [createGraphicEnvBlock(codeWithCustomPos, { gridX: 12, gridY: -7 })]);
		store.set('envConstantContributions.provider', ['const PROVIDED 77']);

		const envBlock = state.codeBlockRendering.codeBlocks.find(block => block.name === AUTO_ENV_BLOCK_NAME);
		expect(envBlock?.code).toContain('; @pos 12 -7');
	});

	test('should default @pos to 0,0 when existing env block has no @pos', () => {
		autoEnvConstants(store);
		store.set('initialProjectState', { ...EMPTY_DEFAULT_PROJECT });

		const envCodeBlock = state.initialProjectState!.constants.find(block => block.code[0] === 'constants env')!;
		const codeWithoutPos = envCodeBlock.code.filter(line => !line.includes('@pos'));
		store.set('codeBlockRendering.codeBlocks', [createGraphicEnvBlock(codeWithoutPos)]);
		store.set('envConstantContributions.provider', ['const PROVIDED 77']);

		const envBlock = state.codeBlockRendering.codeBlocks.find(block => block.name === AUTO_ENV_BLOCK_NAME);
		expect(envBlock?.code).toContain('; @pos 0 0');
	});

	test('should not duplicate env block if already exists', () => {
		const projectWithEnv: ProjectObjectModel = {
			...EMPTY_DEFAULT_PROJECT,
			constants: [
				{
					id: 0,
					code: ['constants env', 'const PROVIDED 123', 'constantsEnd'],
				},
			],
		};

		store.set('initialProjectState', projectWithEnv);
		autoEnvConstants(store);

		// Trigger another load
		store.set('initialProjectState', { ...projectWithEnv });

		const envBlocks = state.initialProjectState?.constants.filter(block => block.code[0]?.includes('constants env'));
		expect(envBlocks?.length).toBe(1);
	});
});
