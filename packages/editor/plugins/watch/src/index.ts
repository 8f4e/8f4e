import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import drawWatch from './drawer/draw';
import { registerWatchLayout } from './state/layout';
import type { WatchValue } from './types';

export function createWatchPlugin({ prefersReducedMotion }: { prefersReducedMotion: () => boolean }): EditorPlugin {
	return {
		id: 'watch',
		setup: ({ layout, drawers }) => {
			const watchesByBlock = new WeakMap<CodeBlockGraphicData, WatchValue[]>();
			const unregisterLayout = registerWatchLayout(layout, watchesByBlock);
			const unregisterDrawer = drawers.registerCodeBlockOverlay(({ draw, state, codeBlock, memoryViews }) => {
				drawWatch(
					draw,
					state.viewport.vGrid,
					state.viewport.hGrid,
					watchesByBlock.get(codeBlock) ?? [],
					memoryViews,
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
