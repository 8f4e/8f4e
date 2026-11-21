import type { EditorPlugin } from '@8f4e/editor-core';
import { createWireConnections, type WireConnectionVisitor } from './connections';
import { LineDrawer } from './line-drawer';
import { drawLooseWire } from './loose-wire';
import { resolveWireColors } from './wire-colors';

function createWiresPlugin(drawWire: typeof drawLooseWire): EditorPlugin {
	return {
		id: 'wires',
		setup: ({ store, events, drawers }) => {
			const connections = createWireConnections(store.getState(), events);
			try {
				const unregisterLayer = drawers.registerRenderLayer(({ gl, palette }) => {
					const lines = new LineDrawer(gl);
					let colors = resolveWireColors(palette);
					const drawConnection: WireConnectionVisitor = (inputX, inputY, outputX, outputY, selected) => {
						drawWire(
							lines,
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
}

/** Draws straight wires independently of connector sprite presentation. */
export const wiresPlugin = createWiresPlugin((lines, x1, y1, x2, y2, thickness, color) => {
	lines.drawLine(x1, y1, x2, y2, thickness, color);
});

/** Draws wires with slack. Install in place of `wiresPlugin`. */
export const looseWiresPlugin = createWiresPlugin(drawLooseWire);
