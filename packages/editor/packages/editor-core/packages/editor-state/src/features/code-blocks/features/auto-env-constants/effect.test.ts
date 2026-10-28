import { createMockEventDispatcher } from '@8f4e/editor-state-testing';
import type { CodeBlockGraphicData, EditorConfig, RuntimeRegistry, State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, test } from 'vitest';
import { EMPTY_DEFAULT_PROJECT } from '~/features/project-loading/emptyDefaultProject';
import createDefaultState from '~/pureHelpers/state/createDefaultState';
import { createMockCodeBlock } from '~/pureHelpers/testingUtils/testUtils';
import runtimeEffect from '../../../runtime/effect';
import autoEnvConstants from './effect';

const AUTO_ENV_BLOCK_NAME = 'env';
const PROJECT_WITH_CODE_BLOCK: ProjectObjectModel = {
	...EMPTY_DEFAULT_PROJECT,
	modules: [{ id: 0, code: ['module demo', 'moduleEnd'], entry: 'main' }],
};

function getTestRuntimeEnvConstants(editorConfig: EditorConfig) {
	const testRuntime = editorConfig.testRuntime;
	const magicNumber =
		testRuntime && typeof testRuntime === 'object' && typeof testRuntime.magicNumber === 'number'
			? testRuntime.magicNumber
			: 50;
	return [`const RUNTIME_MAGIC ${magicNumber}`];
}

const runtimeRegistry: RuntimeRegistry = {
	WebWorkerRuntime: {
		id: 'WebWorkerRuntime',
		getEnvConstants: getTestRuntimeEnvConstants,
		factory: () => () => {},
	},
	SecondaryRuntime: {
		id: 'SecondaryRuntime',
		getEnvConstants: config => [...getTestRuntimeEnvConstants(config), 'const RUNTIME_EXTRA 128'],
		factory: () => () => {},
	},
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
			editorConfig: {
				...createDefaultState().editorConfig,
				runtime: 'WebWorkerRuntime',
			},
			initialProjectState: {
				...EMPTY_DEFAULT_PROJECT,
			},
		};
		store = createStateManager<State>(baseState);
		state = store.getState();
		runtimeEffect(store, createMockEventDispatcher(), runtimeRegistry);
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
			modules: [{ id: 0, code: ['module test', 'moduleEnd'], entry: 'main' }],
		};

		store.set('initialProjectState', projectWithBlocks);
		autoEnvConstants(store);

		// Trigger another project load to add env block
		store.set('initialProjectState', { ...projectWithBlocks });

		expect(state.initialProjectState?.constants[0].code[0]).toBe('constants env');
		expect(state.initialProjectState?.modules[0].code[0]).toBe('module test');
	});

	test('should include constants returned by the selected runtime contribution', () => {
		autoEnvConstants(store);
		store.set('editorConfig.testRuntime', { magicNumber: 123 });
		store.set('initialProjectState', { ...PROJECT_WITH_CODE_BLOCK });

		const envBlock = state.initialProjectState?.constants.find(block => block.code[0]?.includes('constants env'));
		const magicNumberLine = envBlock?.code.find(line => line.includes('RUNTIME_MAGIC'));
		expect(magicNumberLine).toBe('const RUNTIME_MAGIC 123');
		const unusedRuntimeLine = envBlock?.code.find(line => line.includes('UNUSED_RUNTIME_MAGIC'));
		expect(unusedRuntimeLine).toBeUndefined();
	});

	test('should only include an extra constant when the selected runtime contributes it', () => {
		autoEnvConstants(store);
		store.set('initialProjectState', { ...PROJECT_WITH_CODE_BLOCK });

		const envBlock = state.initialProjectState?.constants.find(block => block.code[0]?.includes('constants env'));
		expect(envBlock?.code).not.toContain('const RUNTIME_EXTRA 128');

		store.set('editorConfig.runtime', 'SecondaryRuntime');
		store.set('initialProjectState', { ...PROJECT_WITH_CODE_BLOCK });

		const secondaryRuntimeEnvBlock = state.initialProjectState?.constants.find(block =>
			block.code[0]?.includes('constants env')
		);
		expect(secondaryRuntimeEnvBlock?.code).toContain('const RUNTIME_EXTRA 128');
	});

	test('should include warning comment', () => {
		autoEnvConstants(store);
		store.set('initialProjectState', { ...EMPTY_DEFAULT_PROJECT });

		const envBlock = state.initialProjectState?.constants.find(block => block.code[0]?.includes('constants env'));
		const warningLine = envBlock?.code.find(line => line.includes('Auto-generated'));
		expect(warningLine).toBeDefined();
	});

	test('should update when runtime-contributed constants change', () => {
		autoEnvConstants(store);
		store.set('initialProjectState', { ...EMPTY_DEFAULT_PROJECT });

		// Simulate codeBlockRendering populating codeBlocks from initialProjectState
		const envCodeBlock = state.initialProjectState?.constants.find(block => block.code[0]?.includes('constants env'));
		if (envCodeBlock) {
			store.set('codeBlockRendering.codeBlocks', [createGraphicEnvBlock(envCodeBlock.code)]);
		}

		store.set('codeBlockRendering.codeBlocks', [createGraphicEnvBlock(envCodeBlock?.code ?? [])]);
		store.set('editorConfig.testRuntime', { magicNumber: 77 });

		const envBlock = state.codeBlockRendering.codeBlocks.find(block => block.name === AUTO_ENV_BLOCK_NAME);
		const magicNumberLine = envBlock?.code.find(line => line.includes('RUNTIME_MAGIC'));
		expect(magicNumberLine).toBe('const RUNTIME_MAGIC 77');
		const unusedRuntimeLine = envBlock?.code.find(line => line.includes('UNUSED_RUNTIME_MAGIC'));
		expect(unusedRuntimeLine).toBeUndefined();
	});

	test('includes contributed source alongside runtime constants when creating env', () => {
		autoEnvConstants(store);
		store.set('envConstantContributions', {
			first: ['const FIRST 1'],
			runtime: state.envConstantContributions.runtime,
			empty: [],
			second: ['; second provider', 'const SECOND 2'],
		});
		store.set('initialProjectState', { ...EMPTY_DEFAULT_PROJECT });
		const env = state.initialProjectState?.constants.find(block => block.code[0] === 'constants env');
		expect(env?.code).toEqual(
			expect.arrayContaining(['const RUNTIME_MAGIC 50', 'const FIRST 1', '; second provider', 'const SECOND 2'])
		);
		expect(env?.code.filter(line => line.startsWith('const '))).toEqual([
			'const FIRST 1',
			'const RUNTIME_MAGIC 50',
			'const SECOND 2',
		]);
	});

	test('refreshes contributed constants and removes contributions without changing the env position', () => {
		autoEnvConstants(store);
		store.set('codeBlockRendering.codeBlocks', [
			createGraphicEnvBlock(['constants env', '; @pos 7 9', 'constantsEnd'], {
				parsedDirectives: [
					{
						prefix: '@',
						name: 'pos',
						args: ['7', '9'],
						sourceLineIndex: 1,
						sourceLine: '; @pos 7 9',
						isTrailing: false,
					},
				],
			}),
		]);
		store.set('envConstantContributions.example', ['const PROVIDED 42']);
		const env = state.codeBlockRendering.codeBlocks[0];
		expect(env.code).toContain('const PROVIDED 42');
		expect(env.code).toContain('; @pos 7 9');
		store.set('envConstantContributions', { runtime: state.envConstantContributions.runtime });
		expect(env.code).not.toContain('const PROVIDED 42');
		expect(env.code).toContain('; @pos 7 9');
	});

	test('should preserve existing @pos when regenerating env block', () => {
		autoEnvConstants(store);
		store.set('initialProjectState', { ...EMPTY_DEFAULT_PROJECT });

		const envCodeBlock = state.initialProjectState?.constants.find(block => block.code[0]?.includes('constants env'));
		let codeWithCustomPos: string[] = [];
		if (envCodeBlock) {
			codeWithCustomPos = [...envCodeBlock.code];
			codeWithCustomPos[1] = '; @pos 12 -7';
			store.set('codeBlockRendering.codeBlocks', [createGraphicEnvBlock(codeWithCustomPos, { gridX: 12, gridY: -7 })]);
		}

		store.set('codeBlockRendering.codeBlocks', [createGraphicEnvBlock(codeWithCustomPos, { gridX: 12, gridY: -7 })]);
		store.set('editorConfig.testRuntime', { magicNumber: 77 });

		const envBlock = state.codeBlockRendering.codeBlocks.find(block => block.name === AUTO_ENV_BLOCK_NAME);
		expect(envBlock?.code).toContain('; @pos 12 -7');
	});

	test('should default @pos to 0,0 when existing env block has no @pos', () => {
		autoEnvConstants(store);
		store.set('initialProjectState', { ...EMPTY_DEFAULT_PROJECT });

		const envCodeBlock = state.initialProjectState?.constants.find(block => block.code[0]?.includes('constants env'));
		let codeWithoutPos: string[] = [];
		if (envCodeBlock) {
			codeWithoutPos = envCodeBlock.code.filter(line => !line.includes('@pos'));
			store.set('codeBlockRendering.codeBlocks', [createGraphicEnvBlock(codeWithoutPos)]);
		}

		store.set('codeBlockRendering.codeBlocks', [createGraphicEnvBlock(codeWithoutPos)]);
		store.set('editorConfig.testRuntime', { magicNumber: 77 });

		const envBlock = state.codeBlockRendering.codeBlocks.find(block => block.name === AUTO_ENV_BLOCK_NAME);
		expect(envBlock?.code).toContain('; @pos 0 0');
	});

	test('should not duplicate env block if already exists', () => {
		const projectWithEnv: ProjectObjectModel = {
			...EMPTY_DEFAULT_PROJECT,
			constants: [
				{
					id: 0,
					code: ['constants env', 'const RUNTIME_MAGIC 123', 'constantsEnd'],
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
