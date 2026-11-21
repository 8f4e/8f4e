import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES, type PaletteConfig, resolvePalette } from '@8f4e/editor-palette';
import { gapCalculator } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, CodeBlockPointerDownEvent, InternalPointerEvent } from '@8f4e/editor-state-types';
import { INPUT_LAYERS } from '@8f4e/editor-state-types';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';

const LABEL = textToGlyphIds('Enter group');
const RESERVED_ROWS = 2;
const BUTTON_COLUMNS = LABEL.length + 4;
const SHADOW_RIGHT = textToGlyphIds('▄');
const SHADOW_BOTTOM = textToGlyphIds('▀'.repeat(BUTTON_COLUMNS));

interface ButtonBounds {
	x: number;
	y: number;
	width: number;
	height: number;
	labelX: number;
	shadowX: number;
	shadowY: number;
	bottomShadow: GlyphIds;
}

function contains(button: ButtonBounds, x: number, y: number): boolean {
	return (
		(x >= button.x && x < button.x + button.width && y >= button.y && y < button.y + button.height) ||
		(x >= button.x + button.shadowX &&
			x < button.x + button.width + button.shadowX &&
			y >= button.y + button.shadowY &&
			y < button.y + button.height + button.shadowY)
	);
}

export const enterGroupButtonPlugin: EditorPlugin = {
	id: 'enter-group-button',
	setup: ({ store, events, layout, drawers }) => {
		const state = store.getState();
		let shadowColor = PALETTE_INDICES.black;
		const updateShadowColor = () => {
			shadowColor = resolvePalette(state.editorConfig.color as PaletteConfig | undefined).isDark
				? PALETTE_INDICES.black
				: PALETTE_INDICES.inkAlpha30;
		};
		updateShadowColor();
		store.subscribe('editorConfig.color', updateShadowColor);
		const buttons = new WeakMap<CodeBlockGraphicData, ButtonBounds>();
		const contribution = layout.createContribution();
		const unsubscribeLayout = layout.subscribe(({ codeBlock, state }) => {
			const row = codeBlock.displayModel.sourceLineIndexToDisplayRow[0];
			if (!codeBlock.childProject || row === undefined) {
				buttons.delete(codeBlock);
				contribution.remove(codeBlock);
				return;
			}
			contribution.update(codeBlock, {
				verticalSpaceAfterSourceLine: [{ sourceLineIndex: 0, heightInRows: RESERVED_ROWS }],
			});
			const { vGrid, hGrid } = state.viewport;
			const columns = Math.min(BUTTON_COLUMNS, codeBlock.width / vGrid - 2);
			const x = Math.floor((codeBlock.width / vGrid - columns) / 2) * vGrid;
			buttons.set(codeBlock, {
				x,
				y: (gapCalculator(row, codeBlock.gaps) + 1) * hGrid,
				width: columns * vGrid,
				height: hGrid,
				labelX: x + Math.floor((columns - LABEL.length) / 2) * vGrid,
				shadowX: vGrid,
				shadowY: Math.ceil(hGrid / 2),
				bottomShadow: columns === BUTTON_COLUMNS ? SHADOW_BOTTOM : SHADOW_BOTTOM.slice(0, columns),
			});
		});

		let pressedBlock: CodeBlockGraphicData | undefined;
		let pressedInside = false;
		const reset = () => {
			pressedBlock = undefined;
			pressedInside = false;
		};
		const hitTest = (block: CodeBlockGraphicData, { x, y }: InternalPointerEvent) => {
			const button = buttons.get(block);
			return !!button && contains(button, x - block.x + state.viewport.x, y - block.y + state.viewport.y);
		};
		const onBlockPointerDown = (event: CodeBlockPointerDownEvent) => {
			reset();
			const button = buttons.get(event.codeBlock);
			if (event.buttons !== 1 || !button || !contains(button, event.relativeX, event.relativeY)) return;
			event.stopPropagation = true;
			pressedBlock = event.codeBlock;
			pressedInside = true;
		};
		const onPointerMove = (event: InternalPointerEvent) => {
			if (!pressedBlock) return;
			if (event.buttons !== 1) {
				reset();
				return;
			}
			event.stopPropagation = true;
			pressedInside = hitTest(pressedBlock, event);
		};
		const onPointerUp = (event: InternalPointerEvent) => {
			const codeBlock = pressedBlock;
			if (!codeBlock) return;
			reset();
			event.stopPropagation = true;
			if (state.codeBlockRendering.currentProject.blocks.includes(codeBlock) && hitTest(codeBlock, event)) {
				events.dispatch('openProjectGroup', { codeBlock });
			}
		};
		const onPointerCancel = (event: InternalPointerEvent) => {
			if (pressedBlock) event.stopPropagation = true;
			reset();
		};

		const removeDrawer = drawers.registerCodeBlockDrawer(({ draw, renderedBlock: { codeBlock } }) => {
			const button = buttons.get(codeBlock);
			if (!button) return;
			const pressed = pressedBlock === codeBlock && pressedInside;
			const { x, y, width, height, labelX, shadowX, bottomShadow } = button;
			if (!pressed) {
				draw.drawGlyphs(x + width, y, SHADOW_RIGHT, shadowColor);
				draw.drawGlyphs(x + shadowX, y + height, bottomShadow, shadowColor);
			}
			draw.drawFill(x, y, PALETTE_INDICES.selectionSurface, width, height);
			draw.drawGlyphs(labelX, y, LABEL, PALETTE_INDICES.selectionInk);
		});

		const inputLayer = { capture: true, layer: INPUT_LAYERS.codeBlock };
		events.on('codeBlockPointerDown', onBlockPointerDown, inputLayer);
		events.on('pointermove', onPointerMove, inputLayer);
		events.on('pointerup', onPointerUp, inputLayer);
		events.on('pointercancel', onPointerCancel, inputLayer);
		store.subscribe('codeBlockRendering.currentProject', reset);
		store.subscribe('dialogStack', reset);
		store.subscribe('contextMenu.open', reset);
		return () => {
			events.off('codeBlockPointerDown', onBlockPointerDown);
			events.off('pointermove', onPointerMove);
			events.off('pointerup', onPointerUp);
			events.off('pointercancel', onPointerCancel);
			store.unsubscribe('codeBlockRendering.currentProject', reset);
			store.unsubscribe('dialogStack', reset);
			store.unsubscribe('contextMenu.open', reset);
			store.unsubscribe('editorConfig.color', updateShadowColor);
			reset();
			unsubscribeLayout();
			removeDrawer();
			contribution.dispose();
		};
	},
};
