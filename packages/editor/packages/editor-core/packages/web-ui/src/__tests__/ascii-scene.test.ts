import { PALETTE_INDICES } from '@8f4e/editor-palette';
import {
	createMockCodeBlock,
	createMockEventDispatcher,
	createMockState,
	createMockViewport,
} from '@8f4e/editor-state-testing';
import type { State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { AsciiRenderer } from '@8f4e/web-ui-testing';
import { expect, it } from 'vitest';
import type { EditorDrawerHost } from '../drawers/registry';
import initWebUi, { createEditorDrawerRegistry, createSpriteCell, type MemoryViews, textToGlyphIds } from '../index';

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
	const state = createMockState({ viewport, project: { activeLevel: { blocks } } });
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

it('snapshots the resolved text of a dragged module', async () => {
	const code = [
		'',
		'lorem ipsum dolor sit amet',
		'consectetur adipiscing elit',
		'sed do eiusmod tempor',
		'ut enim ad minim veniam',
		'quis nostrud exercitation',
		'',
	];
	const block = createMockCodeBlock({ x: 16, y: 16, width: 256, height: code.length * 16, code });
	const state = createMockState({
		viewport: createMockViewport(0, 0, 1024, 768),
		editorMode: 'view',
		featureFlags: { moduleDragging: false, viewportDragging: false },
		project: { activeLevel: { blocks: [block] }, draggedCodeBlock: block },
	});
	const codeCells = code.map(line =>
		textToGlyphIds(line).map(glyph => (glyph === 32 ? null : createSpriteCell(glyph, PALETTE_INDICES.inkBase)))
	);
	const drawers = createEditorDrawerRegistry();
	drawers.registerCodeBlockDrawer(({ draw, state }) => {
		codeCells.forEach((cells, row) => draw.drawResolvedText(state.viewport.vGrid, row * state.viewport.hGrid, cells));
	});
	await withAsciiViewport(state, drawers, async render => {
		await expect(render()).toMatchFileSnapshot('./__snapshots__/dragged-module.viewport.snap');
	});
});
