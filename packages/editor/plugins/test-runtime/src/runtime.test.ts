import { compileProject, parseProjectSource } from '@8f4e/compiler';
import type { EventDispatcher } from '@8f4e/editor-core';
import { createMockState } from '@8f4e/editor-state-testing';
import { executeTests } from '@8f4e/runtime-test-runner/execute-tests';
import type { TestRunResult, TestRuntimeProgram } from '@8f4e/runtime-test-runner/types';
import createStateManager from '@8f4e/state-manager';
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
	let program = initialProgram;
	const state = createMockState({
		compiler: { isCompiling },
		assertionResults: [],
		info: { other: { retained: true } },
		editorConfig: { testRuntime: { enabled: true } },
	});
	const store = createStateManager(state);
	const events = { dispatch: vi.fn() } as unknown as EventDispatcher;
	const dispose = createTestRuntimePlugin({
		getCodeBuffer: () => program?.codeBuffer ?? new Uint8Array(),
		getMemory: () => program?.memory ?? null,
		getAssertionSites: () => program?.assertionSites,
		Worker: FakeWorker as unknown as new () => Worker,
	}).setup({ store, events } as unknown as import('@8f4e/editor-core').EditorPluginContext);
	return {
		state,
		store,
		events,
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
	});

	it('publishes source sites, outcomes, and failure details and clears them on restart and disposal', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { state, store, dispose } = setup(createProgram());
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
		expect(state.assertionResults).toEqual([
			{ site: assertion.site, passed: false, message: 'Assertion failed: expected nonzero, received 0' },
		]);
		expect(state.info.testRuntime).toMatchObject(result);
		store.set('compiler.isCompiling', true);
		expect(state.assertionResults).toEqual([]);
		store.set('compiler.isCompiling', false);
		FakeWorker.instances[1].emit(result);
		expect(state.assertionResults).toHaveLength(1);
		dispose();
		expect(state.assertionResults).toEqual([]);
	});

	it('publishes expected and received values from executed Wasm assertions to the editor', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const compiled = await compileProject(
			parseProjectSource(`8f4e/v1
entry test
module checks
push 10
assertEqual 9
push 0
assert
push 1
assert
moduleEnd
entryEnd`),
			{ enableAssertions: true }
		);
		const program = {
			codeBuffer: compiled.codeBuffer,
			assertionSites: compiled.assertionSites!,
			memory: new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true }),
		};
		const { state, dispose } = setup(program);
		FakeWorker.instances[0].emit(await executeTests(program));
		expect(state.assertionResults).toEqual([
			{ site: compiled.assertionSites![0], passed: false, message: 'Assertion failed: expected 9, received 10' },
			{ site: compiled.assertionSites![1], passed: false, message: 'Assertion failed: expected nonzero, received 0' },
			{ site: compiled.assertionSites![2], passed: true },
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
		expect(state.info.testRuntime).toMatchObject({ status: 'passed', assertionSites: [] });
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
		const { store, state, events, setProgram, dispose } = setup(createProgram());
		const worker = FakeWorker.instances[0];
		worker.emit({ status: 'error', error: 'integer divide by zero' });
		expect(state.info.testRuntime).toMatchObject({ status: 'error' });
		expect(state.assertionResults).toEqual([]);
		expect(events.dispatch).toHaveBeenCalledWith('memoryValuesChanged');
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
