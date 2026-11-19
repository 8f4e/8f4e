import type { EditorPlugin } from '@8f4e/editor-core';
import { type ConnectorConnectionVisitor, createConnectorConnections } from '@8f4e/editor-plugin-connectors';
import { LineDrawer } from './line-drawer';
import { resolveWireColors } from './wire-colors';

/** Draws WebGL wires independently of connector sprite presentation. */
export const wiresPlugin: EditorPlugin = {
	id: 'wires',
	setup: ({ store, events, drawers }) => {
		const connections = createConnectorConnections(store.getState(), events);
		try {
			const unregisterLayer = drawers.registerRenderLayer(({ gl, palette }) => {
				const lines = new LineDrawer(gl);
				let colors = resolveWireColors(palette);
				const drawConnection: ConnectorConnectionVisitor = (inputX, inputY, outputX, outputY, selected) => {
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
					draw: ({ state, memoryViews }) => {
						lines.reset();
						if (state.dialogStack.length === 0) connections.visit(memoryViews.int32, drawConnection);
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
