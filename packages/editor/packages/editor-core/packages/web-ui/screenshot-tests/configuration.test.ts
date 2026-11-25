import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState, { applyCodeBlockSourceEdits, EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import type { EventDispatcher } from '@8f4e/editor-state-types';
import initializeWebUi, { createEditorRenderRegistry, registerWebUiConfig } from '@8f4e/web-ui';
import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import createMockMemoryViews from './utils/createMockMemoryViews';

test('applies project appearance settings and restores defaults after project replacement', async () => {
	const handlers = new Map<string, Set<(event: unknown) => void>>();
	const events: EventDispatcher = {
		on: (name, callback) => {
			const listeners = handlers.get(name) ?? new Set();
			listeners.add(callback as (event: unknown) => void);
			handlers.set(name, listeners);
		},
		off: (name, callback) => {
			handlers.get(name)?.delete(callback as (event: unknown) => void);
		},
		dispatch: (name, ...[payload]) => {
			for (const callback of handlers.get(name) ?? []) callback(payload);
		},
	};
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 256;
	const store = initState(events, { callbacks: {} });
	// Use the same registration order as editor-core, before renderer and project initialization.
	registerWebUiConfig(store);
	const renderRegistry = createEditorRenderRegistry();
	const removeDrawer = renderRegistry.registerCanvasBackgroundDrawer(({ draw }) => {
		draw.drawFill(0, 0, PALETTE_INDICES.inkBase, 8, 8);
	});
	const engine = new Engine(canvas);
	const renderer = await initializeWebUi(store, events, engine, createMockMemoryViews(0), {
		loading: store.loading,
		renderRegistry,
	});
	const readInk = () => {
		renderer.renderFrame();
		const pixels = new Uint8Array(4);
		engine.gl.readPixels(2, canvas.height - 3, 1, 1, engine.gl.RGBA, engine.gl.UNSIGNED_BYTE, pixels);
		return [...pixels];
	};
	const state = store.getState();
	events.dispatch('resize', { canvasWidth: canvas.width, canvasHeight: canvas.height });
	const module = {
		type: 'module' as const,
		entry: 'main',
		id: 0,
		code: ['module sample', '; @pos 4 2', 'int value 1', 'moduleEnd'],
	};
	try {
		const defaultInk = readInk();
		events.dispatch('loadProject', {
			project: {
				...EMPTY_DEFAULT_PROJECT,
				execution: [module],
				entries: ['main'],
				notes: [
					{
						id: 1,
						code: [
							'note settings',
							'; @pos 4 10',
							'; @config font x11miscfixed6x10',
							'; @config color.ink #361845',
							'noteEnd',
						],
					},
				],
			},
		});
		await expect.poll(() => state.viewport.vGrid).toBe(6);
		expect(state.viewport.hGrid).toBe(10);
		const block = state.project.rootLevel.blocks.find(block => block.name === 'sample')!;
		expect({ x: block.x, y: block.y }).toEqual({ x: 24, y: 20 });
		expect(state.codeErrors['editor-directives']).toEqual([]);
		expect(readInk()).toEqual([54, 24, 69, 255]);
		const settings = state.project.rootLevel.blocks.find(block => block.name === 'settings')!;
		applyCodeBlockSourceEdits(store, [
			{
				codeBlock: settings,
				code: settings.code.map(line =>
					line.replace('x11miscfixed6x10', 'terminus10x18').replace('#361845', '#102432')
				),
			},
		]);
		await expect.poll(() => state.viewport.vGrid).toBe(10);
		expect(state.viewport.hGrid).toBe(18);
		expect({ x: block.x, y: block.y }).toEqual({ x: 40, y: 36 });
		expect(readInk()).toEqual([16, 36, 50, 255]);
		events.dispatch('loadProject', { project: { ...EMPTY_DEFAULT_PROJECT, execution: [module], entries: ['main'] } });
		await expect.poll(() => state.viewport.vGrid).toBe(8);
		expect(state.viewport.hGrid).toBe(16);
		expect(state.editorConfig).toEqual({});
		const replacement = state.project.rootLevel.blocks.find(block => block.name === 'sample')!;
		expect({ x: replacement.x, y: replacement.y }).toEqual({ x: 32, y: 32 });
		expect(readInk()).toEqual(defaultInk);
	} finally {
		renderer.destroy();
		removeDrawer();
		store.dispose();
		engine.gl.getExtension('WEBGL_lose_context')?.loseContext();
	}
});
