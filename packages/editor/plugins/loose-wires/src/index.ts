import type { EditorPlugin } from '@8f4e/editor-core';
import { createWireConnections, type WireConnectionVisitor } from '@8f4e/editor-plugin-wires/connections';
import { createSlackWireDrawer } from './slack-wire-drawer';

/** Draws pixelated slack wires without installing the straight wire renderer. */
export const looseWiresPlugin: EditorPlugin = {
	id: 'loose-wires',
	setup: ({ store, events, drawers }) => {
		const connections = createWireConnections(store.getState(), events);
		try {
			const unregisterLayer = drawers.registerRenderLayer(({ gl, palette }) => {
				const drawer = createSlackWireDrawer(gl);
				let colors = palette.rgba;
				const drawConnection: WireConnectionVisitor = (inputX, inputY, outputX, outputY, selected) => {
					drawer.drawWire(
						inputX,
						inputY,
						outputX,
						outputY,
						selected ? 2 : 1,
						selected ? colors.strokeStrong : colors.strokeBase
					);
				};
				return {
					draw: ({ state, memoryViews, renderGeometry }) => {
						drawer.reset();
						if (state.dialogStack.length === 0) connections.visit(renderGeometry, memoryViews.int32, drawConnection);
						drawer.flush();
					},
					loadPalette: nextPalette => {
						colors = nextPalette.rgba;
					},
					releaseMemory: drawer.releaseMemory,
					destroy: drawer.destroy,
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
