import { describe, expect, it } from 'vitest';

import { createMockCodeBlock, createMockEventDispatcher, createMockState, createMockViewport } from './index';

describe('editor-state testing utilities', () => {
	it('creates code blocks with derived grid, cursor, and empty parsed directives', () => {
		const block = createMockCodeBlock({
			x: 16,
			y: 32,
			width: 80,
			height: 40,
			code: ['module synth', '; @home @testDirective', 'moduleEnd'],
		});

		expect(block.gridX).toBe(2);
		expect(block.gridY).toBe(2);
		expect(block.cursor).toEqual({ col: 0, row: 0, x: 56, y: 20 });
		expect(block.parsedDirectives).toEqual([]);
	});

	it('allows tests to provide code block names explicitly', () => {
		const block = createMockCodeBlock({
			code: ['module synth', 'moduleEnd'],
			name: 'synth',
		});

		expect(block.name).toBe('synth');
	});

	it('allows tests to provide directive records explicitly', () => {
		const block = createMockCodeBlock({
			code: ['module synth', '; @home', 'moduleEnd'],
			parsedDirectives: [
				{
					prefix: '@',
					name: 'home',
					args: [],
					sourceLineIndex: 1,
					sourceLine: '; @home',
					isTrailing: false,
				},
			],
		});

		expect(block.parsedDirectives).toEqual([
			{
				prefix: '@',
				name: 'home',
				args: [],
				sourceLineIndex: 1,
				sourceLine: '; @home',
				isTrailing: false,
			},
		]);
	});

	it('deep merges state overrides without sharing default collections', () => {
		const state = createMockState({
			info: { compiler: { compilationTimeMs: 120 } },
			viewport: { width: 400 },
		});
		const secondState = createMockState();

		expect(state.info.compiler?.compilationTimeMs).toBe(120);
		expect(state.viewport.width).toBe(400);
		expect(state.viewport.height).toBe(768);
		expect(state.codeBlockRendering.currentProject.blocks).not.toBe(
			secondState.codeBlockRendering.currentProject.blocks
		);
	});

	it('creates no-op event dispatchers and viewports', () => {
		const dispatcher = createMockEventDispatcher();
		const viewport = createMockViewport(10, 20, 300, 200);

		expect(() => dispatcher.dispatch('anything')).not.toThrow();
		expect(viewport).toMatchObject({
			x: 10,
			y: 20,
			width: 300,
			height: 200,
			roundedWidth: 300,
			roundedHeight: 200,
		});
	});

	it('provides complete compiler defaults and fresh mutable state for every fixture', async () => {
		const state = createMockState();
		const other = createMockState();
		expect(state.compiler.result.memoryPlan).toEqual({ modules: {}, moduleList: [] });
		expect(state.compiler.result.projectMemoryExposuresByGroupPath).toEqual({});
		expect(state.compiler.result.memoryDefaultsByModuleId).toEqual({});
		expect(state.compiler.result.memoryPlan.moduleList).not.toBe(other.compiler.result.memoryPlan.moduleList);
		state.compiler.result.projectMemoryExposuresByGroupPath.root = [];
		state.codeBlockRendering.currentProject.blocks.push(createMockCodeBlock());
		expect(other.compiler.result.memoryPlan.moduleList).toEqual([]);
		expect(other.compiler.result.projectMemoryExposuresByGroupPath).toEqual({});
		expect(other.codeBlockRendering.currentProject.blocks).toEqual([]);
	});

	it('uses a root-only block override as the active slice without copying it', () => {
		const blocks = [createMockCodeBlock()];
		const state = createMockState({ codeBlockRendering: { rootProject: { entries: [], path: '', blocks: blocks } } });
		expect(state.codeBlockRendering.rootProject.blocks).toBe(blocks);
		expect(state.codeBlockRendering.currentProject.blocks).toBe(blocks);
	});

	it('owns an active-only block override in the root tree', () => {
		const blocks = [createMockCodeBlock()];
		const state = createMockState({
			codeBlockRendering: { currentProject: { entries: [], path: '', blocks: blocks } },
		});
		expect(state.codeBlockRendering.rootProject.blocks).toBe(blocks);
		expect(state.codeBlockRendering.currentProject.blocks).toBe(blocks);
	});

	it('preserves an explicitly selected nested slice and its project ownership', () => {
		const nested = [createMockCodeBlock({ projectPath: 'group' })];
		const root = [createMockCodeBlock({ name: 'group', childProject: { entries: [], path: '', blocks: nested } })];
		const state = createMockState({
			codeBlockRendering: {
				rootProject: { entries: [], path: '', blocks: root },
				currentProject: { entries: [], path: '', blocks: nested },
			},
		});
		expect(state.codeBlockRendering.rootProject.blocks).toBe(root);
		expect(state.codeBlockRendering.currentProject.blocks).toBe(root[0].childProject?.blocks);
	});

	it('retains callback and collection overrides while preserving unrelated nested defaults', async () => {
		const writeClipboardText = async (_text: string) => {};
		const blocks = [createMockCodeBlock()];
		const state = createMockState({
			callbacks: { writeClipboardText },
			codeBlockRendering: { currentProject: { entries: [], path: '', blocks: blocks } },
			compiler: { isCompiling: true },
		});
		expect(state.callbacks.writeClipboardText).toBe(writeClipboardText);
		expect(state.codeBlockRendering.currentProject.blocks).toBe(blocks);
		expect(state.compiler.isCompiling).toBe(true);
		expect(state.compiler.result.memoryPlan).toEqual({ modules: {}, moduleList: [] });
	});
});
