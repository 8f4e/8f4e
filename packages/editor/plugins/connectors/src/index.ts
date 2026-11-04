import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { gapCalculator } from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import drawConnections from './drawer/connections';
import drawConnectors from './drawer/connectors';
import deriveConnectors from './layout/deriveConnectors';
import { getParamShapeDeclarations } from './layout/param-shape';
import { getShapeDeclarations } from './layout/shape';
import { LineDrawer } from './line-drawer';
import type { ConnectorWidgets, Output } from './types';
import { resolveWireColors } from './wire-colors';

/** Owns expanded declaration labels, input/output presentation, and the GPU wire pass for one editor. */
export const connectorsPlugin: EditorPlugin = {
	id: 'connectors',
	setup: ({ store, events, layout, drawers }) => {
		const widgetsByBlock = new WeakMap<CodeBlockGraphicData, ConnectorWidgets>();
		const labelsByBlock = new WeakMap<CodeBlockGraphicData, Array<{ x: number; y: number; text: string }>>();
		const contribution = layout.createContribution();
		const outputsByByteAddress = new Map<number, Output>();
		const rebuildOutputIndex = () => {
			outputsByByteAddress.clear();
			for (const block of store.getState().codeBlockRendering.currentProject.blocks) {
				for (const output of widgetsByBlock.get(block)?.outputs ?? []) {
					outputsByByteAddress.set(output.memory.byteAddress, output);
				}
			}
		};
		const unregisterLayer = drawers.registerRenderLayer(({ gl, palette }) => {
			const lines = new LineDrawer(gl);
			let wireColors = resolveWireColors(palette);
			return {
				draw: ({ state, memoryViews }) => {
					lines.reset();
					if (state.dialogStack.length === 0) {
						drawConnections(lines, wireColors, state, memoryViews, widgetsByBlock, outputsByByteAddress);
					}
					lines.flush();
				},
				loadPalette: nextPalette => {
					wireColors = resolveWireColors(nextPalette);
				},
				releaseMemory: () => lines.releaseMemory(),
				destroy: () => lines.destroy(),
			};
		});
		events.on('codeBlockLayoutsChanged', rebuildOutputIndex);
		const unsubscribeLayout = layout.subscribe(({ codeBlock, state }) => {
			const declarations = [
				...getShapeDeclarations(codeBlock, state),
				...getParamShapeDeclarations(codeBlock, state),
			].filter(
				declaration => codeBlock.displayModel.sourceLineIndexToDisplayRow[declaration.sourceLineIndex] !== undefined
			);
			const rowsBySourceLine = new Map<number, number>();
			for (const { sourceLineIndex, rowOffset } of declarations) rowsBySourceLine.set(sourceLineIndex, rowOffset);
			contribution.update(codeBlock, {
				verticalSpaceAfterSourceLine: [...rowsBySourceLine].map(([sourceLineIndex, heightInRows]) => ({
					sourceLineIndex,
					heightInRows,
				})),
			});
			labelsByBlock.set(
				codeBlock,
				declarations.map(({ sourceLineIndex, rowOffset, text }) => ({
					x: (codeBlock.lineNumberColumnWidth + 2) * state.viewport.vGrid,
					y:
						(gapCalculator(codeBlock.displayModel.sourceLineIndexToDisplayRow[sourceLineIndex]!, codeBlock.gaps) +
							rowOffset) *
						state.viewport.hGrid,
					text,
				}))
			);
			widgetsByBlock.set(codeBlock, deriveConnectors(codeBlock, state));
		});
		const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, state, codeBlock, memoryViews }) => {
			for (const { x, y, text } of labelsByBlock.get(codeBlock) ?? [])
				draw.drawText(x, y, text, PALETTE_INDICES.inkBase);
			const widgets = widgetsByBlock.get(codeBlock);
			if (widgets) drawConnectors(draw, state, widgets, memoryViews);
		});

		return () => {
			unsubscribeLayout();
			events.off('codeBlockLayoutsChanged', rebuildOutputIndex);
			unregisterDrawer();
			contribution.dispose();
			outputsByByteAddress.clear();
			unregisterLayer();
		};
	},
};
