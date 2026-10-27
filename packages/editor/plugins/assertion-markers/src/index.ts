import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import deriveAssertionMarkers from './deriveAssertionMarkers';

export const assertionMarkersPlugin: EditorPlugin = {
	id: 'assertion-markers',
	setup: ({ drawers }) =>
		drawers.registerCodeBlockDrawer(({ draw, state, codeBlock }) => {
			for (const { x, y, width, height, passed } of deriveAssertionMarkers(codeBlock, state)) {
				draw.drawFill(x, y, passed ? PALETTE_INDICES.positiveBase : PALETTE_INDICES.negativeBase, width, height);
			}
		}),
};
