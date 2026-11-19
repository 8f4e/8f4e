import { PALETTE_INDICES } from '@8f4e/editor-palette';
import {
	createMockCodeBlock,
	createMockEventDispatcher,
	createMockState,
	createMockViewport,
} from '@8f4e/editor-state-testing';
import type { State } from '@8f4e/editor-state-types';
import { FILL_SPRITE_ID } from '@8f4e/sprite-generator';
import createStateManager from '@8f4e/state-manager';
import { AsciiRenderer } from '@8f4e/web-ui-testing';
import { expect, it } from 'vitest';
import type { EditorDrawerHost } from '../drawers/registry';
import initWebUi, { createEditorDrawerRegistry, type MemoryViews, textToGlyphIds } from '../index';

async function withAsciiViewport(
	state: State,
	drawers: EditorDrawerHost,
	assertFrame: (render: () => string) => Promise<void>
): Promise<void> {
	const emptyBuffer = new ArrayBuffer(0);
	const memoryViews: MemoryViews = {
		int8: new Int8Array(emptyBuffer),
		int16: new Int16Array(emptyBuffer),
		int32: new Int32Array(emptyBuffer),
		uint8: new Uint8Array(emptyBuffer),
		uint16: new Uint16Array(emptyBuffer),
		float32: new Float32Array(emptyBuffer),
		float64: new Float64Array(emptyBuffer),
	};
	const store = createStateManager(state);
	const renderer = new AsciiRenderer(state.viewport.width, state.viewport.height);
	try {
		const view = await initWebUi(store, createMockEventDispatcher(), renderer, memoryViews, {
			defaultFont: 'ibmvga8x16',
			drawers,
			loading: { add: () => ({ done: () => {}, fail: () => {}, cancel: () => {} }) },
		});
		try {
			await assertFrame(() => {
				view.renderFrame();
				return `${renderer.toText()}\n`;
			});
		} finally {
			view.destroy();
		}
	} finally {
		store.dispose();
	}
}

it('snapshots a full viewport with overlap and clipping through the web-ui frame loop', async () => {
	const cellWidth = 8;
	const cellHeight = 16;
	const viewport = createMockViewport(cellWidth, cellHeight, 32 * cellWidth, 10 * cellHeight);
	const back = createMockCodeBlock({
		creationIndex: 0,
		x: viewport.x + 4 * cellWidth,
		y: viewport.y + 2 * cellHeight,
		width: 36 * cellWidth,
		height: 4 * cellHeight,
		code: ['module rear', '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz0123456789', 'moduleEnd'],
	});
	const front = createMockCodeBlock({
		creationIndex: 1,
		x: viewport.x + 11 * cellWidth,
		y: viewport.y + 3 * cellHeight,
		width: 8 * cellWidth,
		height: 2 * cellHeight,
		code: ['front', ''],
	});
	const blocks = [back, front];
	const glyphsByBlock = new Map(blocks.map(block => [block.creationIndex, block.code.map(textToGlyphIds)]));
	const state = createMockState({ viewport, codeBlockRendering: { currentProject: { blocks } } });
	const drawers = createEditorDrawerRegistry();
	drawers.registerCodeBlockDrawer(({ draw, codeBlock }) => {
		draw.drawFill(0, 0, PALETTE_INDICES.surfaceBase, codeBlock.width, codeBlock.height);
	});
	drawers.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
		glyphsByBlock.get(codeBlock.creationIndex)!.forEach((glyphs, row) => {
			draw.drawGlyphs(0, row * state.viewport.hGrid, glyphs, PALETTE_INDICES.inkBase);
		});
	});
	await withAsciiViewport(state, drawers, async render => {
		await expect(render()).toMatchFileSnapshot('./__snapshots__/overlapping-blocks.viewport.snap');
	});
});

it('does not overwrite visible text with clipped or transparent sprites, and clears between frames', () => {
	const renderer = new AsciiRenderer(3, 1);
	renderer.setPalette(Uint8Array.of(255, 255, 255, 255, 0, 0, 0, 0));
	const phases: string[] = [];
	renderer.hooks.preDraw.push(() => phases.push('pre'));
	renderer.hooks.postDraw.push(() => phases.push('post'));
	renderer.renderFrame(() => {
		phases.push('sprites');
		renderer.drawSprite(-1, 0, 65, 0, 3);
		renderer.drawSprite(-2, 0, 66, 0);
		renderer.drawSprite(1, 0, 32, 0);
		renderer.drawSprite(0, 0, FILL_SPRITE_ID, 1);
		renderer.drawSprite(2, 0, 130, 0);
	});
	expect(renderer.toText()).toBe('AA?');
	expect(phases).toEqual(['pre', 'sprites', 'post']);
	renderer.resize(2, 1);
	renderer.renderFrame(() => {});
	expect(renderer.toText()).toBe('  ');
});
