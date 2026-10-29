import { describe, expect, it } from 'vitest';

import { createMockCodeBlock, createMockEventDispatcher, createMockState, createMockViewport } from './index';

describe('editor-state testing utilities', () => {
	it('creates code blocks with derived grid, cursor, and empty parsed directives', () => {
		const block = createMockCodeBlock({
			x: 16,
			y: 32,
			width: 80,
			height: 40,
			code: ['module synth', '; @home @favorite', 'moduleEnd'],
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
		expect(state.codeBlockRendering.outputsByWordAddress).not.toBe(secondState.codeBlockRendering.outputsByWordAddress);
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
		expect(state.compiler.memoryPlan).toEqual({ modules: {}, moduleList: [] });
		expect(state.compiler.projectMemoryExposuresByGroupPath).toEqual({});
		expect(state.compiler.memoryDefaultsByModuleId).toEqual({});
		expect(state.compiler.memoryPlan.moduleList).not.toBe(other.compiler.memoryPlan.moduleList);
		state.compiler.projectMemoryExposuresByGroupPath.root = [];
		state.codeBlockRendering.codeBlocks.push(createMockCodeBlock());
		expect(state.codeBlockRendering.outputsByWordAddress).not.toBe(other.codeBlockRendering.outputsByWordAddress);
		expect(other.compiler.memoryPlan.moduleList).toEqual([]);
		expect(other.compiler.projectMemoryExposuresByGroupPath).toEqual({});
		expect(other.codeBlockRendering.codeBlocks).toEqual([]);
		expect(other.codeBlockRendering.outputsByWordAddress.size).toBe(0);
	});

	it('uses a root-only block override as the active slice without copying it', () => {
		const blocks = [createMockCodeBlock()];
		const state = createMockState({ codeBlockRendering: { rootCodeBlocks: blocks } });
		expect(state.codeBlockRendering.rootCodeBlocks).toBe(blocks);
		expect(state.codeBlockRendering.codeBlocks).toBe(blocks);
	});

	it('owns an active-only block override in the root tree', () => {
		const blocks = [createMockCodeBlock()];
		const state = createMockState({ codeBlockRendering: { codeBlocks: blocks } });
		expect(state.codeBlockRendering.rootCodeBlocks).toBe(blocks);
		expect(state.codeBlockRendering.codeBlocks).toBe(blocks);
	});

	it('preserves an explicitly selected nested slice and its project ownership', () => {
		const nested = [createMockCodeBlock({ projectPath: 'group' })];
		const root = [createMockCodeBlock({ name: 'group', nestedProjectCodeBlocks: nested })];
		const state = createMockState({ codeBlockRendering: { rootCodeBlocks: root, codeBlocks: nested } });
		expect(state.codeBlockRendering.rootCodeBlocks).toBe(root);
		expect(state.codeBlockRendering.codeBlocks).toBe(root[0].nestedProjectCodeBlocks);
	});

	it('retains callback and collection overrides while preserving unrelated nested defaults', async () => {
		const writeClipboardText = async (_text: string) => {};
		const outputs = new Map();
		const state = createMockState({
			callbacks: { writeClipboardText },
			compiler: { isCompiling: true },
			codeBlockRendering: { outputsByWordAddress: outputs },
		});
		expect(state.callbacks.writeClipboardText).toBe(writeClipboardText);
		expect(state.codeBlockRendering.outputsByWordAddress).toBe(outputs);
		expect(state.compiler.isCompiling).toBe(true);
		expect(state.compiler.memoryPlan).toEqual({ modules: {}, moduleList: [] });
	});
});
