import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { gapCalculator } from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';
import drawConnectors from './drawer/connectors';
import deriveConnectors from './layout/deriveConnectors';
import { getParamShapeDeclarations } from './layout/param-shape';
import { getShapeDeclarations } from './layout/shape';
import type { ConnectorWidgets } from './types';

export { type ConnectorConnectionVisitor, createConnectorConnections } from './connections';

/** Owns expanded declaration labels and input/output sprite presentation for one editor. */
export const connectorsPlugin: EditorPlugin = {
	id: 'connectors',
	setup: ({ layout, drawers }) => {
		const widgetsByBlock = new WeakMap<CodeBlockGraphicData, ConnectorWidgets>();
		const labelsByBlock = new WeakMap<CodeBlockGraphicData, Array<{ x: number; y: number; glyphs: GlyphIds }>>();
		const contribution = layout.createContribution();
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
		return () => {
			unsubscribeLayout();
			unregisterDrawer();
			contribution.dispose();
		};
	},
};
