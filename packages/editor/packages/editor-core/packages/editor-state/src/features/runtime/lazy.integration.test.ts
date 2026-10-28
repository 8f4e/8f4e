import type { RuntimeRegistryEntry } from '@8f4e/editor-state-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import initState from '../../index';
import { createMockEventDispatcherWithVitest } from '../../pureHelpers/testingUtils/vitestTestUtils';
import { EMPTY_DEFAULT_PROJECT } from '../project-loading/emptyDefaultProject';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup() {
	let finish!: (entry: RuntimeRegistryEntry) => void;
	const load = vi.fn(
		() =>
			new Promise<RuntimeRegistryEntry>(resolve => {
				finish = resolve;
			})
	);
	const destroy = vi.fn();
	const factory = vi.fn(() => destroy);
	const otherDestroy = vi.fn();
	const otherFactory = vi.fn(() => otherDestroy);
	const implementation: RuntimeRegistryEntry = {
		id: 'CustomRuntime',
		editorConfigSchema: {
			root: 'customRuntime',
			defaults: { rate: 50 },
			schema: { type: 'object', properties: { rate: { type: 'number', minimum: 1 } }, additionalProperties: false },
		},
		getEnvConstants: config => [`const RATE ${(config.customRuntime as { rate: number }).rate}`],
		factory,
	};
	const events = createMockEventDispatcherWithVitest();
	const store = initState(events, {
		callbacks: {},
		runtimeRegistry: {
			CustomRuntime: {
				id: 'CustomRuntime',
				editorConfigSchema: {
					root: 'customRuntime',
					defaults: { rate: 50 },
					schema: { type: 'object' },
				},
				load,
			},
			Other: { id: 'Other', factory: otherFactory },
		},
	});
	cleanups.push(store.dispose);
	store.set('initialProjectState', {
		...EMPTY_DEFAULT_PROJECT,
		notes: [
			{
				id: 0,
				code: [
					'note config',
					'; @config runtime CustomRuntime',
					'; @config customRuntime.rate 75',
					'; @config customRuntime.unknown 1',
					'noteEnd',
				],
			},
		],
	});
	return {
		store,
		state: store.getState(),
		load,
		factory,
		destroy,
		otherFactory,
		otherDestroy,
		finish: () => finish(implementation),
	};
}

describe('lazy runtime ownership through editor initialization', () => {
	it('publishes only metadata and revalidates configuration and env constants after loading', async () => {
		const test = setup();
		expect(test.load).toHaveBeenCalledOnce();
		expect(test.factory).not.toHaveBeenCalled();
		expect(test.state.codeErrors.editorDirectiveErrors).toEqual([]);
		expect(test.state.runtimeRegistry.CustomRuntime).not.toHaveProperty('load');
		expect(test.state.runtimeRegistry.CustomRuntime).not.toHaveProperty('factory');
		test.finish();
		await vi.waitFor(() => expect(test.factory).toHaveBeenCalledOnce());
		expect(test.state.editorConfig.customRuntime).toEqual({ rate: 75 });
		expect(test.state.codeErrors.editorDirectiveErrors).toEqual([
			expect.objectContaining({ message: expect.stringContaining('customRuntime.unknown') }),
		]);
		expect(test.state.envConstantContributions.runtime).toEqual(['const RATE 75']);
		const env = test.state.codeBlockRendering.rootCodeBlocks.find(block => block.name === 'env');
		expect(env?.code).toContain('const RATE 75');
		expect(test.state.runtimeRegistry.CustomRuntime).not.toHaveProperty('getEnvConstants');
	});

	it('ignores an obsolete selection and reuses its loaded implementation when selected again', async () => {
		const test = setup();
		const config = test.state.codeBlockRendering.rootCodeBlocks.find(block => block.blockType === 'note')!;
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', config);
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', [
			'note config',
			'; @config runtime Other',
			'noteEnd',
		]);
		expect(test.otherFactory).toHaveBeenCalledOnce();
		test.finish();
		await vi.waitFor(() =>
			expect(test.state.runtimeRegistry.CustomRuntime.editorConfigSchema?.schema.properties).toBeDefined()
		);
		expect(test.factory).not.toHaveBeenCalled();
		// Use a config edit so schema revalidation sees the new selection as project source.
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', [
			'note config',
			'; @config runtime CustomRuntime',
			'; @config customRuntime.rate 80',
			'noteEnd',
		]);
		expect(test.factory).toHaveBeenCalledOnce();
		expect(test.load).toHaveBeenCalledOnce();
		expect(test.otherDestroy).toHaveBeenCalledOnce();
		expect(test.state.envConstantContributions.runtime).toEqual(['const RATE 80']);
	});

	it('waits for compilation before starting a newly loaded runtime', async () => {
		const test = setup();
		test.store.set('compiler.isCompiling', true);
		test.finish();
		await vi.waitFor(() => expect(test.state.envConstantContributions.runtime).toEqual(['const RATE 75']));
		expect(test.factory).not.toHaveBeenCalled();
		test.store.set('compiler.isCompiling', false);
		expect(test.factory).toHaveBeenCalledOnce();
	});

	it('does not publish metadata or start a runtime after disposal during loading', async () => {
		const test = setup();
		test.store.dispose();
		const set = vi.spyOn(test.store, 'set');
		test.finish();
		await Promise.resolve();
		await Promise.resolve();
		expect(set).not.toHaveBeenCalled();
		expect(test.factory).not.toHaveBeenCalled();
	});
});
