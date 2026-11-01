import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import drawConnections from './drawer/connections';
import drawConnectors from './drawer/connectors';
import deriveConnectors from './layout/deriveConnectors';
import { LineDrawer } from './line-drawer';
import type { ConnectorWidgets, Output } from './types';
import { resolveWireColors } from './wire-colors';

/** Owns input/output presentation and the complete GPU wire pass for one editor. */
export const connectorsPlugin: EditorPlugin = {
	id: 'connectors',
	setup: ({ store, events, layout, drawers }) => {
		const widgetsByBlock = new WeakMap<CodeBlockGraphicData, ConnectorWidgets>();
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
			widgetsByBlock.set(codeBlock, deriveConnectors(codeBlock, state));
		});
		const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, state, codeBlock, memoryViews }) => {
			const widgets = widgetsByBlock.get(codeBlock);
			if (widgets) drawConnectors(draw, state, widgets, memoryViews);
		});

		return () => {
			unsubscribeLayout();
			events.off('codeBlockLayoutsChanged', rebuildOutputIndex);
			unregisterDrawer();
			outputsByByteAddress.clear();
			unregisterLayer();
		};
	},
};
