import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import drawStack from './drawer/draw';
import { registerStackLayout } from './state/layout';
import type { StackLabel } from './types';

export function createStackPlugin({ prefersReducedMotion }: { prefersReducedMotion: () => boolean }): EditorPlugin {
	return {
		id: 'stack',
		setup: ({ layout, drawers }) => {
			const labelsByBlock = new WeakMap<CodeBlockGraphicData, StackLabel[]>();
			const unregisterLayout = registerStackLayout(layout, labelsByBlock);
			const unregisterDrawer = drawers.registerCodeBlockOverlay(({ draw, state, codeBlock }) => {
				drawStack(
					draw,
					state.viewport.vGrid,
					state.viewport.hGrid,
					labelsByBlock.get(codeBlock) ?? [],
					performance.now(),
					prefersReducedMotion()
				);
			});
			return () => {
				unregisterDrawer();
				unregisterLayout();
			};
		},
	};
}
