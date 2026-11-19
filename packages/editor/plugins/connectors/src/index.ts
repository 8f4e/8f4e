import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { gapCalculator } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, CodeBlockLayoutsChangedEvent } from '@8f4e/editor-state-types';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';
import { registerConnectorGeometry } from './connections';
import drawConnectors from './drawer/connectors';
import deriveConnectors from './layout/deriveConnectors';
import { getParamShapeDeclarations } from './layout/param-shape';
import { getShapeDeclarations } from './layout/shape';
import type { ConnectorWidgets, Output } from './types';

export { type ConnectorConnectionVisitor, visitConnectorConnections } from './connections';

/** Owns expanded declaration labels, input/output sprites, and connection geometry for one editor. */
export const connectorsPlugin: EditorPlugin = {
	id: 'connectors',
	setup: ({ store, events, layout, drawers }) => {
		const widgetsByBlock = new WeakMap<CodeBlockGraphicData, ConnectorWidgets>();
		const labelsByBlock = new WeakMap<CodeBlockGraphicData, Array<{ x: number; y: number; glyphs: GlyphIds }>>();
		const contribution = layout.createContribution();
		const outputsByByteAddress = new Map<number, Output>();
		const rebuildOutputIndex = ({ project }: CodeBlockLayoutsChangedEvent) => {
			if (project !== store.getState().codeBlockRendering.currentProject) return;
			outputsByByteAddress.clear();
			for (const block of project.blocks) {
				for (const output of widgetsByBlock.get(block)?.outputs ?? []) {
					outputsByByteAddress.set(output.memory.byteAddress, output);
				}
			}
		};
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
					glyphs: textToGlyphIds(text),
				}))
			);
			widgetsByBlock.set(codeBlock, deriveConnectors(codeBlock, state));
		});
		const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, state, codeBlock, memoryViews }) => {
			for (const { x, y, glyphs } of labelsByBlock.get(codeBlock) ?? [])
				draw.drawGlyphs(x, y, glyphs, PALETTE_INDICES.inkBase);
			const widgets = widgetsByBlock.get(codeBlock);
			if (widgets) drawConnectors(draw, state, widgets, memoryViews);
		});
		const unregisterGeometry = registerConnectorGeometry(store.getState(), { widgetsByBlock, outputsByByteAddress });

		return () => {
			unregisterGeometry();
			unsubscribeLayout();
			events.off('codeBlockLayoutsChanged', rebuildOutputIndex);
			unregisterDrawer();
			contribution.dispose();
			outputsByByteAddress.clear();
		};
	},
};
