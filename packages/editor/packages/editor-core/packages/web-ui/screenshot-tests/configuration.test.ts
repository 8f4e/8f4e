import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState, { applyCodeBlockSourceEdits, EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import type { EventDispatcher } from '@8f4e/editor-state-types';
import init, { createEditorDrawerRegistry, registerWebUiConfig, textToGlyphIds } from '@8f4e/web-ui';
import { expect, test } from 'vitest';
import createCanvas from './utils/createCanvas';
import createMockMemoryViews from './utils/createMockMemoryViews';

const SAMPLE_TEXT = textToGlyphIds('Sample text');

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
	const canvas = createCanvas();
	canvas.width = 512;
	canvas.height = 256;
	const store = initState(events, { callbacks: {} });
	// Use the same registration order as editor-core, before renderer and project initialization.
	registerWebUiConfig(store);
	const drawers = createEditorDrawerRegistry();
	const removeDrawer = drawers.registerCodeBlockDrawer(({ draw, state }) => {
		draw.drawGlyphs(state.viewport.vGrid, state.viewport.hGrid, SAMPLE_TEXT, PALETTE_INDICES.inkBase);
	});
	const renderer = await init(store, events, canvas, createMockMemoryViews(), { loading: store.loading, drawers });
	const state = store.getState();
	events.dispatch('resize', { canvasWidth: canvas.width, canvasHeight: canvas.height });
	const module = {
		type: 'module' as const,
		entry: 'main',
		id: 0,
		code: ['module sample', '; @pos 4 2', 'int value 1', 'moduleEnd'],
	};
	try {
		store.set('initialProjectState', {
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
						'; @config color.canvas #361845',
						'noteEnd',
					],
				},
			],
		});
		await expect.poll(() => state.viewport.vGrid).toBe(6);
		const block = state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'sample')!;
		expect({ x: block.x, y: block.y }).toEqual({ x: 24, y: 20 });
		expect(state.codeErrors['editor-directives']).toEqual([]);
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot('configured-appearance');
		const settings = state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'settings')!;
		applyCodeBlockSourceEdits({ store, events }, [
			{
				codeBlock: settings,
				code: settings.code.map(line =>
					line.replace('x11miscfixed6x10', 'terminus10x18').replace('#361845', '#102432')
				),
			},
		]);
		await expect.poll(() => state.viewport.vGrid).toBe(10);
		expect({ x: block.x, y: block.y }).toEqual({ x: 40, y: 36 });
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot('edited-appearance');
		store.set('initialProjectState', { ...EMPTY_DEFAULT_PROJECT, execution: [module], entries: ['main'] });
		await expect.poll(() => state.viewport.vGrid).toBe(8);
		expect(state.viewport.hGrid).toBe(16);
		expect(state.editorConfig).toEqual({});
		const replacement = state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'sample')!;
		expect({ x: replacement.x, y: replacement.y }).toEqual({ x: 32, y: 32 });
	} finally {
		renderer.destroy();
		removeDrawer();
		store.dispose();
		canvas.remove();
	}
});
