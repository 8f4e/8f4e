import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import drawConnectors from './drawer/connectors';
import deriveConnectors from './layout/deriveConnectors';
import type { ConnectorWidgets } from './types';

/** Owns input/output connector sprite presentation for one editor. */
export const connectorsPlugin: EditorPlugin = {
	id: 'connectors',
	setup: ({ layout, drawers }) => {
		const widgetsByBlock = new WeakMap<CodeBlockGraphicData, ConnectorWidgets>();
		const unsubscribeLayout = layout.subscribe(({ codeBlock, state }) => {
			widgetsByBlock.set(codeBlock, deriveConnectors(codeBlock, state));
		});
		const unregisterDrawer = drawers.registerCodeBlockDrawer(
			({ draw, state, renderedBlock: { codeBlock }, memoryViews }) => {
				const widgets = widgetsByBlock.get(codeBlock);
				if (widgets) drawConnectors(draw, state, widgets, memoryViews);
			}
		);
		return () => {
			unsubscribeLayout();
			unregisterDrawer();
		};
	},
};
