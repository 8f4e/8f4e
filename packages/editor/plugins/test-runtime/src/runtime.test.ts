import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { TestRunResult, TestRuntimeProgram } from '@8f4e/runtime-test-runner/types';
import createStateManager from '@8f4e/state-manager';
import type { TestAssertionResult } from '@8f4e/test-runner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestRuntimePlugin } from './index';

class FakeWorker {
	static instances: FakeWorker[] = [];
	postMessage = vi.fn();
	terminate = vi.fn();
	onmessage: ((event: MessageEvent<TestRunResult>) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;

	constructor() {
		FakeWorker.instances.push(this);
	}
	emit(data: TestRunResult) {
		this.onmessage?.({ data } as MessageEvent<TestRunResult>);
	}
}

function createProgram(): TestRuntimeProgram {
	return {
		codeBuffer: new Uint8Array([1]),
		assertionSites: [],
		memory: new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true }),
	};
}

function setup(initialProgram?: TestRuntimeProgram, isCompiling = false) {
	FakeWorker.instances = [];
	vi.stubGlobal('Worker', FakeWorker);
	let program = initialProgram;
	const state = createMockState({
		compiler: { isCompiling },
		assertionResults: [],
		info: { other: { retained: true } },
		editorConfig: { testRuntime: { enabled: true } },
	});
	const store = createStateManager(state);
	const dispose = createTestRuntimePlugin({
		getCodeBuffer: () => program?.codeBuffer ?? new Uint8Array(),
		getMemory: () => program?.memory ?? null,
		getAssertionSites: () => program?.assertionSites,
	}).setup({
		store,
		loading: { add: () => ({ done: () => {}, fail: () => {}, cancel: () => {} }) },
	} as unknown as import('@8f4e/editor-core').EditorPluginContext);
	return {
		state,
		store,
		dispose,
		setProgram: (value?: TestRuntimeProgram) => {
			program = value;
		},
	};
}

const passed = (): TestRunResult => ({
	status: 'passed',
	assertions: [],
	failures: [],
});

describe('TestRuntime lifecycle', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('publishes source sites, outcomes, and failure details and clears them on restart and disposal', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { state, store, dispose } = setup(createProgram());
		const otherErrors = [{ codeBlockId: 99, lineNumber: 0, message: 'Another contributor' }];
		store.set('codeErrors.other', otherErrors);
		const assertion = {
			site: {
				siteId: 0,
				instruction: 'assert' as const,
				projectBlockId: 7,
				projectGroupPath: '',
				codeBlockType: 'module' as const,
				codeBlockId: 'checks',
				lineNumber: 2,
			},
			passed: false,
			condition: 0,
			assertIndex: 0,
		};
		const result: TestRunResult = { status: 'failed', assertions: [assertion], failures: [assertion] };
		expect(state.assertionResults).toEqual([]);
		FakeWorker.instances[0].emit(result);
		expect(state.assertionResults).toEqual([{ site: assertion.site, passed: false }]);
		expect(state.info.testRuntime).toEqual({ status: 'failed', assertionCount: 1, failureCount: 1 });
		expect(state.codeErrors['test-runtime']).toEqual([
			{
				codeBlockId: 7,
				lineNumber: 2,
				message: 'Assertion failed: expected nonzero, received 0',
			},
		]);
		const block = createMockCodeBlock({ creationIndex: 7, disabled: true });
		state.project.rootLevel.blocks = [block];
		store.set('compilerInputRevision', state.compilerInputRevision + 1);
		expect(state.codeErrors['test-runtime']).toEqual([]);
		expect(state.assertionResults).toHaveLength(1);
		block.disabled = false;
		store.set('compilerInputRevision', state.compilerInputRevision + 1);
		expect(state.codeErrors['test-runtime']).toHaveLength(1);
		store.set('compiler.isCompiling', true);
		expect(state.assertionResults).toEqual([]);
		expect(state.codeErrors['test-runtime']).toEqual([]);
		store.set('compiler.isCompiling', false);
		FakeWorker.instances[1].emit(result);
		expect(state.assertionResults).toHaveLength(1);
		dispose();
		store.set('compilerInputRevision', state.compilerInputRevision + 1);
		expect(state.assertionResults).toEqual([]);
		expect(state.codeErrors['test-runtime']).toBeUndefined();
		expect(state.codeErrors.other).toBe(otherErrors);
	});

	it('publishes expected and received values from worker assertion results to the editor', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const blockSite = {
			projectBlockId: 7,
			projectGroupPath: '',
			codeBlockType: 'module' as const,
			codeBlockId: 'checks',
		};
		const assertions: TestAssertionResult[] = [
			{
				site: { ...blockSite, siteId: 0, instruction: 'assertEqual', lineNumber: 2 },
				passed: false,
				expected: 9,
				received: 10,
				assertIndex: 0,
			},
			{
				site: { ...blockSite, siteId: 1, instruction: 'assert', lineNumber: 4 },
				passed: false,
				condition: 0,
				assertIndex: 1,
			},
			{
				site: { ...blockSite, siteId: 2, instruction: 'assert', lineNumber: 6 },
				passed: true,
				condition: 1,
				assertIndex: 2,
			},
		];
		const assertionSites = assertions.map(assertion => assertion.site);
		const { state, dispose } = setup({ ...createProgram(), assertionSites });
		state.project.rootLevel.blocks = [
			createMockCodeBlock({
				creationIndex: 7,
				name: 'checks',
				blockType: 'module',
				code: ['module checks', 'push 10', 'assertEqual 9', 'push 0', 'assert', 'push 1', 'assert', 'moduleEnd'],
			}),
		];
		FakeWorker.instances[0].emit({ status: 'failed', assertions, failures: [assertions[0], assertions[1]] });
		expect(state.assertionResults).toEqual([
			{ site: assertionSites[0], passed: false },
			{ site: assertionSites[1], passed: false },
			{ site: assertionSites[2], passed: true },
		]);
		expect(state.codeErrors['test-runtime']).toEqual([
			{
				codeBlockId: 7,
				lineNumber: 2,
				message: 'Assertion failed: expected 9, received 10',
			},
			{
				codeBlockId: 7,
				lineNumber: 4,
				message: 'Assertion failed: expected nonzero, received 0',
			},
		]);
		dispose();
	});

	it('runs the latest successful compilation on selection and once after each recompile', () => {
		vi.spyOn(console, 'info').mockImplementation(() => {});
		const firstProgram = createProgram();
		const { state, store, setProgram, dispose } = setup(firstProgram);
		const firstWorker = FakeWorker.instances[0];
		expect(firstWorker.postMessage).toHaveBeenCalledExactlyOnceWith(firstProgram);
		firstWorker.emit(passed());
		expect(firstWorker.terminate).toHaveBeenCalledOnce();
		expect(state.info.testRuntime).toEqual({ status: 'passed', assertionCount: 0, failureCount: 0 });
		expect(state.info.other).toEqual({ retained: true });
		setProgram();
		store.set('compiler.isCompiling', true);
		const secondProgram = createProgram();
		setProgram(secondProgram);
		store.set('compiler.isCompiling', false);
		expect(FakeWorker.instances).toHaveLength(2);
		expect(FakeWorker.instances[1].postMessage).toHaveBeenCalledExactlyOnceWith(secondProgram);
		dispose();
	});

	it('waits for compilation and skips attempts without a current test program', () => {
		const { store, state, setProgram, dispose } = setup(createProgram(), true);
		expect(FakeWorker.instances).toHaveLength(0);
		setProgram();
		store.set('compiler.isCompiling', false);
		expect(FakeWorker.instances).toHaveLength(0);
		store.set('compiler.isCompiling', false);
		expect(FakeWorker.instances).toHaveLength(0);
		expect(state.info.testRuntime).toEqual({ status: 'idle' });
		dispose();
	});

	it('terminates superseded runs and ignores their delayed results', () => {
		const { store, state, setProgram, dispose } = setup(createProgram());
		const firstWorker = FakeWorker.instances[0];
		const oldListener = firstWorker.onmessage!;
		setProgram();
		store.set('compiler.isCompiling', true);
		expect(firstWorker.terminate).toHaveBeenCalledOnce();
		setProgram(createProgram());
		store.set('compiler.isCompiling', false);
		oldListener({ data: passed() } as MessageEvent<TestRunResult>);
		expect(state.info.testRuntime).toMatchObject({ status: 'running' });
		dispose();
	});

	it('publishes runtime errors and stops responding after disposal', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { store, state, setProgram, dispose } = setup(createProgram());
		const worker = FakeWorker.instances[0];
		worker.emit({ status: 'error', error: 'integer divide by zero' });
		expect(state.info.testRuntime).toMatchObject({ status: 'error' });
		expect(state.assertionResults).toEqual([]);
		dispose();
		setProgram(createProgram());
		store.set('compiler.isCompiling', false);
		expect(FakeWorker.instances).toHaveLength(1);
		expect(state.info.testRuntime).toEqual({ status: 'idle' });
	});

	it('reports worker loading errors and terminates the failed worker', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { state, dispose } = setup(createProgram());
		const worker = FakeWorker.instances[0];
		worker.onerror!({ message: 'Worker script failed to load' } as ErrorEvent);
		expect(state.info.testRuntime).toMatchObject({
			status: 'error',
			error: 'Worker script failed to load',
		});
		expect(worker.terminate).toHaveBeenCalledOnce();
		dispose();
	});
});
