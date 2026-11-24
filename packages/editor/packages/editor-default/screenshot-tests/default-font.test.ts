import { parseProjectSource } from '@8f4e/compiler';
import { type Editor, type EventDispatcher, getEditorBlockId } from '@8f4e/editor-core';
import { mountDefaultEditor } from '@8f4e/editor-default';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { dottedBackgroundPlugin } from '@8f4e/editor-plugin-dotted-background';
import { homePlugin } from '@8f4e/editor-plugin-home';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import { centerViewportOnCodeBlock } from '@8f4e/editor-state';
import type { EditorLifecycleEvents } from '@8f4e/editor-state-types';
import { expect, test } from 'vitest';
import { cdp } from 'vitest/browser';

test('uses PixelCode on coarse pointers and restores it after a project font override', async () => {
	const input = cdp();
	await input.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
	const canvas = document.createElement('canvas');
	canvas.width = 390;
	canvas.height = 240;
	document.body.append(canvas);
	const code = [
		'note mobile',
		'; @mode edit',
		'; @pos 3 3',
		'PixelCode 6x12',
		'Numbers: 0123456789',
		'Code: [] {} () +-*/',
		'CP437: é Ç ß α Ω ░▒▓█',
		'noteEnd',
	];
	const initialProjectUrl = `data:text/plain,${encodeURIComponent(`8f4e/v1\n${code.join('\n')}`)}`;
	let editor: Editor | undefined;
	try {
		expect(window.matchMedia('(pointer: coarse)').matches).toBe(true);
		editor = await mountDefaultEditor(canvas, {
			storage: {} as Storage,
			initialProjectUrl,
			plugins: [
				createProjectUrlLoaderPlugin({ fetch: globalThis.fetch, initialProjectUrl }),
				dottedBackgroundPlugin,
				codeBlockBackgroundPlugin,
				codeRenderingPlugin,
			],
		});
		editor.pauseRendering();
		expect(editor.state.viewport).toMatchObject({ vGrid: 6, hGrid: 12 });
		expect(editor.state.editorConfig.font).toBeUndefined();
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot('mobile-pixelcode-default');
		const block = editor.state.project.rootLevel.blocks.find(block => block.name === 'mobile')!;
		const blockId = getEditorBlockId(block);
		editor.editing.applyEdits({
			expectedRevision: editor.editing.getRevision(),
			edits: [{ type: 'update', blockId, code: [code[0], '; @config font ibmvga8x16', ...code.slice(1)] }],
		});
		await expect.poll(() => editor!.state.viewport.vGrid).toBe(8);
		expect(editor.state.viewport.hGrid).toBe(16);
		editor.editing.applyEdits({
			expectedRevision: editor.editing.getRevision(),
			edits: [{ type: 'update', blockId, code }],
		});
		await expect.poll(() => editor!.state.viewport.hGrid).toBe(12);
		expect(editor.state.viewport.vGrid).toBe(6);
		expect(editor.state.editorConfig.font).toBeUndefined();
	} finally {
		editor?.dispose();
		canvas.remove();
		await input.send('Emulation.setTouchEmulationEnabled', { enabled: false });
	}
});

test('positions home using the installed mobile grid on the first frame and the new grid on project replacement', async () => {
	const input = cdp();
	await input.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
	const canvas = document.createElement('canvas');
	canvas.width = 390;
	canvas.height = 240;
	document.body.append(canvas);
	const initialProjectUrl = `data:text/plain,${encodeURIComponent(
		'8f4e/v1\nnote mobileHome\n; @home top\n; @pos 30 40\nMobile home\nnoteEnd'
	)}`;
	let editor: Editor | undefined;
	let events!: EventDispatcher;
	let firstFrame: { x: number; y: number; vGrid: number; hGrid: number; gridSizeReady: boolean } | undefined;
	const placements: Array<{ name: string | undefined; vGrid: number; hGrid: number }> = [];
	try {
		editor = await mountDefaultEditor(canvas, {
			storage: {} as Storage,
			initialProjectUrl,
			plugins: [
				homePlugin,
				createProjectUrlLoaderPlugin({ fetch: globalThis.fetch, initialProjectUrl }),
				dottedBackgroundPlugin,
				codeBlockBackgroundPlugin,
				codeRenderingPlugin,
				{
					id: 'first-frame',
					setup: context => {
						events = context.events;
						const onResolvePosition = ({ level }: EditorLifecycleEvents['resolveInitialProjectViewport']) => {
							const { vGrid, hGrid } = context.store.getState().viewport;
							placements.push({ name: level.blocks.find(block => block.blockType === 'note')?.name, vGrid, hGrid });
						};
						events.on('resolveInitialProjectViewport', onResolvePosition);
						const unregister = context.drawers.registerCanvasDrawer(({ state, viewport }) => {
							const { x, y, vGrid, hGrid } = viewport;
							firstFrame ??= { x, y, vGrid, hGrid, gridSizeReady: state.gridSizeReady };
						});
						return () => {
							unregister();
							events.off('resolveInitialProjectViewport', onResolvePosition);
						};
					},
				},
			],
		});
		editor.pauseRendering();
		const state = editor.state;
		const firstHome = state.project.activeLevel.blocks.find(block => block.name === 'mobileHome')!;
		const initialPosition = centerViewportOnCodeBlock(state.viewport, firstHome, { alignment: 'top' });
		expect(firstFrame).toEqual({ ...initialPosition, vGrid: 6, hGrid: 12, gridSizeReady: true });
		expect(placements).toEqual([{ name: 'mobileHome', vGrid: 6, hGrid: 12 }]);
		expect(state.viewport).toMatchObject(initialPosition);
		expect(state.project.selectedCodeBlock).toBeUndefined();
		await expect(canvas).toMatchScreenshot('mobile-home-position');

		events.dispatch('loadProject', {
			project: parseProjectSource(
				'8f4e/v1\nnote nextHome\n; @config font ibmvga8x16\n; @home bottom\n; @pos 100 50\nNext home\nnoteEnd'
			),
		});
		expect(state.gridSizeReady).toBe(false);
		expect(state.viewport).toMatchObject({ vGrid: 6, hGrid: 12 });
		expect(placements).toHaveLength(1);
		await expect.poll(() => state.gridSizeReady).toBe(true);
		expect(state.viewport).toMatchObject({ vGrid: 8, hGrid: 16 });
		expect(placements).toEqual([
			{ name: 'mobileHome', vGrid: 6, hGrid: 12 },
			{ name: 'nextHome', vGrid: 8, hGrid: 16 },
		]);
		const nextHome = state.project.activeLevel.blocks.find(block => block.name === 'nextHome')!;
		expect(state.viewport).toMatchObject(centerViewportOnCodeBlock(state.viewport, nextHome, { alignment: 'bottom' }));
		expect(state.project.selectedCodeBlock).toBeUndefined();

		// Cancel a replacement while editing the new home's source. Placement must use the latest layout.
		events.dispatch('loadProject', {
			project: parseProjectSource('8f4e/v1\nnote cancelledFontHome\n; @mode edit\n; @home\n; @pos 10 10\nnoteEnd'),
		});
		expect(state.gridSizeReady).toBe(false);
		const cancelledFontHome = state.project.activeLevel.blocks.find(block => block.name === 'cancelledFontHome')!;
		editor.editing.applyEdits({
			expectedRevision: editor.editing.getRevision(),
			edits: [
				{
					type: 'update',
					blockId: getEditorBlockId(cancelledFontHome),
					code: [
						'note cancelledFontHome',
						'; @mode edit',
						'; @config font ibmvga8x16',
						'; @home left',
						'; @pos 150 70',
						'noteEnd',
					],
				},
			],
		});
		await expect.poll(() => state.gridSizeReady).toBe(true);
		expect(state.viewport).toMatchObject({ vGrid: 8, hGrid: 16 });
		expect(placements.at(-1)).toEqual({ name: 'cancelledFontHome', vGrid: 8, hGrid: 16 });
		expect(placements).toHaveLength(3);
		const editedHome = state.project.activeLevel.blocks.find(block => block.name === 'cancelledFontHome')!;
		expect(state.viewport).toMatchObject(centerViewportOnCodeBlock(state.viewport, editedHome, { alignment: 'left' }));
	} finally {
		editor?.dispose();
		canvas.remove();
		await input.send('Emulation.setTouchEmulationEnabled', { enabled: false });
	}
});
