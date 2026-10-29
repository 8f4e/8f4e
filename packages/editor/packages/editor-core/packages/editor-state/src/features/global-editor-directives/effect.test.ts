import createStateManager from '@8f4e/state-manager';
import { describe, expect, it } from 'vitest';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import parsedDirectivesUpdater from '../code-blocks/features/parsedDirectivesUpdater/effect';
import { createSchemaEditorConfigValidator } from '../editor-config/schemaValidator';
import globalEditorDirectivesEffect from './effect';

describe('globalEditorDirectivesEffect', () => {
	it('resolves changed and removed configuration through the shared programmatic edit target', () => {
		const block = createMockCodeBlock({ code: ['note config', '; @config example 120', 'noteEnd'] });
		const blocks = [block];
		const state = createMockState({ codeBlockRendering: { rootCodeBlocks: blocks, codeBlocks: blocks } });
		const store = createStateManager(state);
		store.set(
			'editorConfigValidators.example',
			createSchemaEditorConfigValidator({ root: 'example', schema: { type: 'integer' } })
		);
		parsedDirectivesUpdater(store);
		globalEditorDirectivesEffect(store);
		store.set('codeBlockRendering.codeBlocks', blocks);
		expect(state.editorConfig.example).toBe(120);

		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block);
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', [
			'note config',
			'; @config example 200',
			'noteEnd',
		]);
		expect(state.editorConfig.example).toBe(200);

		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit.code', ['note config', 'noteEnd']);
		expect(state.editorConfig.example).toBeUndefined();
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

	it('resolves configuration from the root tree while navigating project groups', () => {
		const nestedCodeBlocks = [createMockCodeBlock({ code: ['module nested', 'moduleEnd'] })];
		const rootCodeBlocks = [
			createMockCodeBlock({ code: ['note config', '; @config font ibmvga8x16', 'noteEnd'] }),
			createMockCodeBlock({ code: ['group nested', 'groupEnd'], nestedProjectCodeBlocks: nestedCodeBlocks }),
		];
		const state = createMockState({ codeBlockRendering: { rootCodeBlocks, codeBlocks: rootCodeBlocks } });
		const store = createStateManager(state);
		store.set(
			'editorConfigValidators.font',
			createSchemaEditorConfigValidator({ root: 'font', schema: { type: 'string' } })
		);
		parsedDirectivesUpdater(store);
		globalEditorDirectivesEffect(store);
		store.set('codeBlockRendering.codeBlocks', rootCodeBlocks);
		expect(state.editorConfig.font).toBe('ibmvga8x16');
		store.set('codeBlockRendering.codeBlocks', nestedCodeBlocks);
		expect(state.editorConfig.font).toBe('ibmvga8x16');
		store.dispose();
	});
});
