import type { EditorPlugin } from '@8f4e/editor-core';
import drawSelectionAnimation from './draw';

export const selectionAnimationPlugin: EditorPlugin = {
	id: 'selection-animation',
	setup: ({ drawers }) => drawers.registerCodeBlockDrawer(drawSelectionAnimation),
};
