import type { EditorPlugin } from '@8f4e/editor-core';
import { createWireConnections, type WireConnectionVisitor } from './connections';
import { LineDrawer } from './line-drawer';
import { resolveWireColors } from './wire-colors';

/** Draws WebGL wires independently of connector sprite presentation. */
export const wiresPlugin: EditorPlugin = {
	id: 'wires',
	setup: ({ store, events, drawers }) => {
		const connections = createWireConnections(store, events);
		try {
			const unregisterLayer = drawers.registerRenderLayer(({ gl, palette }) => {
				const lines = new LineDrawer(gl);
				let colors = resolveWireColors(palette);
				const drawConnection: WireConnectionVisitor = (inputX, inputY, outputX, outputY, selected) => {
					lines.drawLine(
						inputX,
						inputY,
						outputX,
						outputY,
						selected ? 2 : 1,
						selected ? colors.wireHighlighted : colors.wire
					);
				};
				return {
					draw: ({ state, memoryViews, renderGeometry }) => {
						lines.reset();
						if (state.dialogStack.length === 0) connections.visit(renderGeometry, memoryViews.int32, drawConnection);
						lines.flush();
					},
					loadPalette: nextPalette => {
						colors = resolveWireColors(nextPalette);
					},
					releaseMemory: () => lines.releaseMemory(),
					destroy: () => lines.destroy(),
				};
			});
			return () => {
				connections.dispose();
				unregisterLayer();
			};
		} catch (error) {
			connections.dispose();
			throw error;
		}
	},
};
