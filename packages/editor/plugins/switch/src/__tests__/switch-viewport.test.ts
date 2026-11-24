import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initState, { applyCodeBlockSourceEdits, setGridSize } from '@8f4e/editor-state';
import { TEST_GRID_SIZE } from '@8f4e/editor-state-testing';
import type { EventDispatcher } from '@8f4e/editor-state-types';
import initView, { createEditorDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { AsciiRenderer } from '@8f4e/web-ui-testing';
import { expect, test } from 'vitest';
import { createSwitchPlugin } from '../index';

test('switch plugin draws off and on values', async () => {
	const width = 512;
	const height = 256;
	const ascii = new AsciiRenderer(width, height);
	const project = parseProjectSource(`8f4e/v1
entry main
module controls
; @pos 4 2
int off 0
int on 1
; @switch &off
; @switch &on
moduleEnd
entryEnd`);
	const compiled = await compileProject(project);
	const listeners = new Map<string, Set<(event: unknown) => void>>();
	const events: EventDispatcher = {
		on: (name, callback) => {
			const handlers = listeners.get(name) ?? new Set();
			handlers.add(callback as (event: unknown) => void);
			listeners.set(name, handlers);
		},
		off: (name, callback) => {
			listeners.get(name)?.delete(callback as (event: unknown) => void);
		},
		dispatch: (name, ...[event]) => {
			for (const callback of listeners.get(name) ?? []) callback(event);
		},
	};
	const store = initState(events, {
		callbacks: {},
	});
	setGridSize(store.getState(), events, TEST_GRID_SIZE);
	store.set('editorMode', 'edit');
	const drawers = createEditorDrawerRegistry();
	const disposePlugin = createSwitchPlugin({ writeMemory: () => {} }).setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		drawers,
	});
	const state = store.getState();
	state.viewport.width = width;
	state.viewport.height = height;
	events.dispatch('loadProject', { project });
	store.set('compiler.result', { ...compiled, inputRevision: state.compilerInputRevision });
	store.set('editorMode', 'edit');
	const codeBlock = state.project.activeLevel.blocks.find(block => block.name === 'controls')!;
	store.set('project.activeLevel.blocks', [codeBlock]);
	const colors = {
		canvas: '#000',
		surface: '#111',
		primary: '#336699',
		ink: '#ffcc00',
	};
	store.set('editorConfig.color', colors);
	const buffer = new ArrayBuffer(65536);
	const memoryViews: MemoryViews = {
		int8: new Int8Array(buffer),
		int16: new Int16Array(buffer),
		int32: new Int32Array(buffer),
		uint8: new Uint8Array(buffer),
		uint16: new Uint16Array(buffer),
		float32: new Float32Array(buffer),
		float64: new Float64Array(buffer),
	};
	memoryViews.int32[compiled.memoryPlan.modules.controls.memory.on.allocationUnitAddress] = 1;

	const renderer = await initView(store, events, ascii, memoryViews, {
		loading: store.loading,
		drawers,
	});
	try {
		renderer.renderFrame();
		await expect(`${ascii.toText()}\n`).toMatchFileSnapshot('./__snapshots__/switch-values.viewport.snap');
		applyCodeBlockSourceEdits(store, [
			{
				codeBlock,
				code: [
					'module controls',
					'; @pos 4 2',
					'int off 0',
					'int on 1',
					'push 0 ; @switch &off',
					'drop ; @switch &on',
					'moduleEnd',
				],
			},
		]);
		// Source edits resolve project config again; reapply this drawing fixture's explicit palette.
		store.set('editorConfig.color', colors);
		renderer.renderFrame();
		await expect(`${ascii.toText()}\n`).toMatchFileSnapshot('./__snapshots__/trailing-switches.viewport.snap');
	} finally {
		renderer.destroy();
		disposePlugin();
		store.dispose();
	}
});
