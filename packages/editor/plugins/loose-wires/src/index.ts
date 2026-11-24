import type { EditorPlugin } from '@8f4e/editor-core';
import type { EditorConfigSchemaContribution } from '@8f4e/editor-state-types';
import { createWireConnections, type WireConnectionVisitor } from './connections';
import { createSlackWireDrawer } from './slack-wire-drawer';

const DEFAULT_SLACK = 0.25;
const configContribution: EditorConfigSchemaContribution = {
	root: 'looseWires',
	schema: {
		type: 'object',
		properties: { slack: { type: 'number', minimum: 0 } },
		additionalProperties: false,
	},
};

export interface LooseWiresPluginOptions {
	/** Nonnegative sag-to-span ratio when `looseWires.slack` is absent; defaults to 0.25. Ratios above 1 are capped. */
	defaultSlack?: number;
}

/** Draws pixelated slack wires without installing the straight wire renderer. */
export function createLooseWiresPlugin({ defaultSlack = DEFAULT_SLACK }: LooseWiresPluginOptions = {}): EditorPlugin {
	return {
		id: 'loose-wires',
		setup: ({ store, events, drawers }) => {
			const connections = createWireConnections(store, events);
			let slack: number;
			const syncSlack = () => {
				const config = store.getState().editorConfig.looseWires as { slack?: number } | undefined;
				slack = Math.min(config?.slack ?? defaultSlack, 1);
			};
			const removeConfig = () => {
				store.unsubscribe('editorConfig.looseWires', syncSlack);
				const schemas = { ...store.getState().editorConfigSchemaContributions };
				delete schemas.looseWires;
				store.set('editorConfigSchemaContributions', schemas);
			};
			try {
				store.set('editorConfigSchemaContributions.looseWires', configContribution);
				syncSlack();
				store.subscribe('editorConfig.looseWires', syncSlack);
				const unregisterLayer = drawers.registerRenderLayer('afterSprites', ({ gl, palette }) => {
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
							drawer.flush(slack);
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
					removeConfig();
				};
			} catch (error) {
				connections.dispose();
				removeConfig();
				throw error;
			}
		},
	};
}
