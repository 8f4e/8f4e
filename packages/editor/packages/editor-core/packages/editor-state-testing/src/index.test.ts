import type { ProjectLevel } from '@8f4e/editor-state-types';
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
		expect(block.cursor).toEqual({ col: 0, row: 0, y: 20 });
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
		expect(state.project.activeLevel.blocks).not.toBe(secondState.project.activeLevel.blocks);
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
		state.project.activeLevel.blocks.push(createMockCodeBlock());
		expect(other.compiler.result.memoryPlan.moduleList).toEqual([]);
		expect(other.compiler.result.projectMemoryExposuresByGroupPath).toEqual({});
		expect(other.project.activeLevel.blocks).toEqual([]);
	});

	it('uses a root-only block override as the active level', () => {
		const blocks = [createMockCodeBlock()];
		const state = createMockState({ project: { rootLevel: { entries: [], path: '', blocks: blocks } } });
		expect(state.project.rootLevel.blocks).toBe(blocks);
		expect(state.project.activeLevel).toBe(state.project.rootLevel);
	});

	it('owns an active-only block override in the root tree', () => {
		const blocks = [createMockCodeBlock()];
		const state = createMockState({
			project: { activeLevel: { blocks } },
		});
		expect(state.project.rootLevel.blocks).toBe(blocks);
		expect(state.project.activeLevel).toBe(state.project.rootLevel);
	});

	it('preserves explicitly selected levels by object identity', () => {
		const nested = { entries: [], path: '', blocks: [createMockCodeBlock({ projectPath: 'group' })] };
		const root = { entries: [], path: '', blocks: [createMockCodeBlock({ name: 'group', childLevel: nested })] };
		const state = createMockState({
			project: {
				rootLevel: root,
				activeLevel: nested,
			},
		});
		expect(state.project.rootLevel).toBe(root);
		expect(state.project.activeLevel).toBe(nested);
		expect(state.project.activeLevel).toBe(root.blocks[0].childLevel);
	});

	it('preserves selection between distinct levels even when their paths and block arrays match', () => {
		const first: ProjectLevel = { entries: [], path: '', blocks: [] };
		const second: ProjectLevel = { ...first };
		const root = {
			entries: [],
			path: '',
			blocks: [
				createMockCodeBlock({ name: 'group', childLevel: first }),
				createMockCodeBlock({ name: 'group', childLevel: second }),
			],
		};
		const state = createMockState({ project: { rootLevel: root, activeLevel: second } });
		expect(first.path).toBe(second.path);
		expect(first.blocks).toBe(second.blocks);
		expect(state.project.activeLevel).toBe(second);
	});

	it('retains callback and collection overrides while preserving unrelated nested defaults', async () => {
		const getWordFromMemory = (_address: number) => 1;
		const blocks = [createMockCodeBlock()];
		const state = createMockState({
			callbacks: { getWordFromMemory },
			project: { activeLevel: { entries: [], path: '', blocks: blocks } },
			compiler: { isCompiling: true },
		});
		expect(state.callbacks.getWordFromMemory).toBe(getWordFromMemory);
		expect(state.project.activeLevel.blocks).toBe(blocks);
		expect(state.compiler.isCompiling).toBe(true);
		expect(state.compiler.result.memoryPlan).toEqual({ modules: {}, moduleList: [] });
	});
});
