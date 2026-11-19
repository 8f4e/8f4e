import type { EditorPlugin } from '@8f4e/editor-core';
import { connectorsPlugin, visitConnectorConnections } from '@8f4e/editor-plugin-connectors';
import { LineDrawer } from './line-drawer';
import { resolveWireColors } from './wire-colors';

/** Draws WebGL wires between the connectors provided by the connectors plugin. */
export const wiresPlugin: EditorPlugin = {
	id: 'wires',
	setup: ({ drawers }) =>
		drawers.registerRenderLayer(({ gl, palette }) => {
			const lines = new LineDrawer(gl);
			let colors = resolveWireColors(palette);
			return {
				draw: ({ state, memoryViews }) => {
					lines.reset();
					if (state.dialogStack.length === 0) {
						visitConnectorConnections(state, memoryViews.int32, (inputX, inputY, outputX, outputY, selected) => {
							lines.drawLine(
								inputX,
								inputY,
								outputX,
								outputY,
								selected ? 2 : 1,
								selected ? colors.wireHighlighted : colors.wire
							);
						});
					}
					lines.flush();
				},
				loadPalette: nextPalette => {
					colors = resolveWireColors(nextPalette);
				},
				releaseMemory: () => lines.releaseMemory(),
				destroy: () => lines.destroy(),
			};
		}),
};

/** Keep both browser plugins in the same deferred activation. */
export const connectorsWithWiresPlugin: EditorPlugin = {
	id: 'connectors',
	setup: context => {
		const disposeConnectors = connectorsPlugin.setup(context);
		let disposeWires: () => void;
		try {
			disposeWires = wiresPlugin.setup(context);
		} catch (error) {
			disposeConnectors();
			throw error;
		}
		return () => {
			try {
				disposeWires();
			} finally {
				disposeConnectors();
			}
		};
	},
};
