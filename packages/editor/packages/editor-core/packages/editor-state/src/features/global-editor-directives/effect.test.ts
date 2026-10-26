import createStateManager from '@8f4e/state-manager';
import { describe, expect, it, vi } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import parsedDirectivesUpdater from '../code-blocks/features/parsedDirectivesUpdater/effect';
import { registerRecompileDebounceDelayEditorConfigValidator } from '../program-compiler/editorConfig';
import runtimeEffect from '../runtime/effect';
import globalEditorDirectivesEffect from './effect';

describe('globalEditorDirectivesEffect', () => {
	it('resolves changed and removed configuration through the shared programmatic edit target', () => {
		const block = createMockCodeBlock({ code: ['note config', '; @config recompileDebounceDelay 120', 'noteEnd'] });
		const blocks = [block];
		const state = createMockState({ codeBlockRendering: { rootCodeBlocks: blocks, codeBlocks: blocks } });
		const store = createStateManager(state);
		registerRecompileDebounceDelayEditorConfigValidator(store);
		parsedDirectivesUpdater(store);
		globalEditorDirectivesEffect(store);
		store.set('codeBlockRendering.codeBlocks', blocks);
		expect(state.editorConfig.recompileDebounceDelay).toBe(120);

		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block);
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', [
			'note config',
			'; @config recompileDebounceDelay 200',
			'noteEnd',
		]);
		expect(state.editorConfig.recompileDebounceDelay).toBe(200);

		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', ['note config', 'noteEnd']);
		expect(state.editorConfig.recompileDebounceDelay).toBeUndefined();
		store.dispose();
	});

	it('updates configuration diagnostic rows when a position directive is inserted', () => {
		const block = createMockCodeBlock({ code: ['note config', '; @config unknown value', 'noteEnd'] });
		const blocks = [block];
		const state = createMockState({ codeBlockRendering: { rootCodeBlocks: blocks, codeBlocks: blocks } });
		const store = createStateManager(state);
		parsedDirectivesUpdater(store);
		globalEditorDirectivesEffect(store);
		store.set('codeBlockRendering.codeBlocks', blocks);
		expect(state.codeErrors.editorDirectiveErrors[0].lineNumber).toBe(1);

		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block);
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', [
			'note config',
			'; @pos 4 8',
			'; @config unknown value',
			'noteEnd',
		]);
		expect(state.codeErrors.editorDirectiveErrors).toEqual([
			expect.objectContaining({ lineNumber: 2, message: expect.stringContaining("unknown config path 'unknown'") }),
		]);
		store.dispose();
	});

	it('keeps the runtime alive when the rendered project-group slice changes', async () => {
		const destroyRuntime = vi.fn();
		const runtimeFactory = vi.fn(() => destroyRuntime);
		const nestedCodeBlocks = [createMockCodeBlock({ code: ['module nested', 'moduleEnd'] })];
		const rootCodeBlocks = [
			createMockCodeBlock({
				code: ['module projectConfig', '; @config runtime WebWorkerRuntime', 'moduleEnd'],
			}),
			createMockCodeBlock({
				code: ['group nested', 'groupEnd'],
				nestedProjectCodeBlocks: nestedCodeBlocks,
			}),
		];
		const state = createMockState({
			runtimeRegistry: {
				WebWorkerRuntime: {
					id: 'WebWorkerRuntime',
					factory: runtimeFactory,
				},
			},
			codeBlockRendering: {
				rootCodeBlocks,
				codeBlocks: rootCodeBlocks,
			},
		});
		const store = createStateManager(state);
		const events = createMockEventDispatcherWithVitest();

		await runtimeEffect(store, events);
		globalEditorDirectivesEffect(store);
		store.set('codeBlockRendering.codeBlocks', rootCodeBlocks);
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(state.editorConfig.runtime).toBe('WebWorkerRuntime');
		expect(runtimeFactory).toHaveBeenCalledTimes(1);

		store.set('codeBlockRendering.codeBlocks', nestedCodeBlocks);
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(state.editorConfig.runtime).toBe('WebWorkerRuntime');
		expect(runtimeFactory).toHaveBeenCalledTimes(1);
		expect(destroyRuntime).not.toHaveBeenCalled();

		store.set('codeBlockRendering.codeBlocks', rootCodeBlocks);
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(runtimeFactory).toHaveBeenCalledTimes(1);
		expect(destroyRuntime).not.toHaveBeenCalled();
	});
});
