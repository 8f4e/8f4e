import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/compiler';
import initState, { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import type { WebWorkerRuntimeMessage } from '@8f4e/runtime-web-worker/messages';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { createWorkerRuntimePlugin } from './index';

const cleanups = new Set<() => void>();
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	vi.unstubAllGlobals();
});

function setup(config = ['enabled true'], ready = true) {
	const workers: MockWorker[] = [];
	class MockWorker {
		postMessage = vi.fn();
		removeEventListener = vi.fn();
		terminate = vi.fn();
		onMessage!: (event: { data: WebWorkerRuntimeMessage }) => void;
		addEventListener = vi.fn((_type: string, listener: typeof this.onMessage) => {
			this.onMessage = listener;
		});
		constructor() {
			workers.push(this);
		}
	}
	vi.stubGlobal('Worker', MockWorker);
	const emitter = new EventEmitter();
	const events = {
		on: emitter.on.bind(emitter),
		off: emitter.off.bind(emitter),
		dispatch: vi.fn(emitter.emit.bind(emitter)),
	};
	const store = initState(events, { callbacks: {} });
	let memory = ready ? new WebAssembly.Memory({ initial: 1 }) : null;
	const getCodeBuffer = vi.fn(() => new Uint8Array([1, 2, 3]));
	const dispose = createWorkerRuntimePlugin({ getMemory: () => memory, getCodeBuffer }).setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		drawers: createEditorDrawerRegistry(),
	});
	const cleanup = () => {
		cleanups.delete(cleanup);
		dispose();
		store.dispose();
	};
	cleanups.add(cleanup);
	const code = (settings: string[]) => [
		'note settings',
		...settings.map(setting => `; @config workerRuntime.${setting}`),
		'noteEnd',
	];
	events.dispatch('loadProject', {
		project: parseProjectSource(
			['8f4e/v1', ...code(config), 'entry main', 'module demo', 'moduleEnd', 'entryEnd'].join('\n')
		),
	});
	const state = store.getState();
	const block = state.codeBlockRendering.codeBlocks.find(block => block.name === 'settings')!;
	return {
		state,
		store,
		events,
		workers,
		getCodeBuffer,
		cleanup,
		configure: (settings: string[]) =>
			applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: code(settings) }], { affectsCompilation: true }),
		compile: () => {
			store.set('compiler.isCompiling', true);
			memory = new WebAssembly.Memory({ initial: 1 });
			store.set('compiler.isCompiling', false);
		},
	};
}

it.each([
	[[], 'main'],
	[['entry alternate'], 'alternate'],
])('initializes the worker with configured entry %s', (settings, entry) => {
	const test = setup(['enabled true', 'sampleRate 25', ...settings]);
	expect(test.state.codeErrors.editorDirectiveErrors).toEqual([]);
	expect(test.workers[0].postMessage).toHaveBeenCalledExactlyOnceWith({
		type: 'init',
		payload: {
			memoryRef: expect.any(WebAssembly.Memory),
			entry,
			sampleRate: 25,
			codeBuffer: new Uint8Array([1, 2, 3]),
		},
	});
});

it('handles initialized and stats messages through its fixed info namespace', () => {
	const test = setup();
	const stats = {
		timerPrecisionPercentage: 99,
		timeToExecuteLoopMs: 1,
		timerDriftMs: 0.5,
		timerExpectedIntervalTimeMs: 20,
	};
	test.events.dispatch.mockClear();
	test.workers[0].onMessage({ data: { type: 'initialized', payload: {} } });
	test.workers[0].onMessage({ data: { type: 'stats', payload: stats } });
	expect(test.events.dispatch).toHaveBeenCalledWith('memoryValuesChanged');
	expect(test.state.info.workerRuntime).toEqual(stats);
});

it('waits for compiler memory, then resends updated artifacts without creating another worker', () => {
	const test = setup(['enabled true'], false);
	expect(test.workers).toHaveLength(0);
	test.compile();
	expect(test.workers).toHaveLength(1);
	test.workers[0].postMessage.mockClear();
	test.getCodeBuffer.mockReturnValue(new Uint8Array([4]));
	test.store.set('compiler.isCompiling', true);
	expect(test.workers[0].postMessage).not.toHaveBeenCalled();
	test.store.set('compiler.isCompiling', false);
	expect(test.workers[0].postMessage).toHaveBeenCalledExactlyOnceWith(
		expect.objectContaining({ payload: expect.objectContaining({ codeBuffer: new Uint8Array([4]) }) })
	);
	expect(test.workers).toHaveLength(1);
});

it('defaults to disabled and owns its constants, worker, info, and schema', () => {
	const test = setup([]);
	expect(test.state.editorConfigSchemaContributions.workerRuntime).toBeDefined();
	expect(test.workers).toHaveLength(0);
	expect(test.state.envConstantContributions.workerRuntime).toBeUndefined();
	test.configure(['enabled true']);
	expect(test.workers).toHaveLength(1);
	expect(test.state.envConstantContributions.workerRuntime).toEqual(['const SAMPLE_RATE 50']);
	test.workers[0].onMessage({
		data: {
			type: 'stats',
			payload: {
				timerPrecisionPercentage: 99,
				timeToExecuteLoopMs: 1,
				timerDriftMs: 0,
				timerExpectedIntervalTimeMs: 20,
			},
		},
	});
	test.configure(['enabled false']);
	expect(test.workers[0].terminate).toHaveBeenCalledOnce();
	expect(test.state.info.workerRuntime).toBeUndefined();
	expect(test.state.envConstantContributions.workerRuntime).toEqual([]);
	test.configure(['enabled true']);
	expect(test.workers).toHaveLength(2);
	test.cleanup();
	expect(test.workers[1].removeEventListener).toHaveBeenCalledOnce();
	expect(test.workers[1].terminate).toHaveBeenCalledOnce();
	expect(test.state.editorConfigSchemaContributions.workerRuntime).toBeUndefined();
	expect(test.state.envConstantContributions.workerRuntime).toBeUndefined();
});

it('configures and replaces its contributed constant name', () => {
	const test = setup();
	expect(test.state.envConstantContributions.workerRuntime).toEqual(['const SAMPLE_RATE 50']);
	test.configure(['enabled true', 'sampleRate 25', 'sampleRateConstantName CONTROL_RATE']);
	expect(test.state.envConstantContributions.workerRuntime).toEqual(['const CONTROL_RATE 25']);
	expect(test.workers[0].postMessage).toHaveBeenLastCalledWith(
		expect.objectContaining({ payload: expect.objectContaining({ sampleRate: 25 }) })
	);
	expect(test.state.codeErrors.editorDirectiveErrors).toEqual([]);
});
