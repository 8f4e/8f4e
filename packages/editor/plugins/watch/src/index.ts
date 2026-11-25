import type { EditorPlugin } from '@8f4e/editor-core';
import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import drawWatch from './drawer/draw';
import { registerWatchPreparation } from './state/layout';
import type { WatchValue } from './types';

export function createWatchPlugin({ prefersReducedMotion }: { prefersReducedMotion: () => boolean }): EditorPlugin {
	return {
		id: 'watch',
		setup: ({ store, layout, renderRegistry }) => {
			const watchesByBlock = new WeakMap<EditorCodeBlock, WatchValue[]>();
			const unregisterPreparation = registerWatchPreparation(store, layout, watchesByBlock);
			const unregisterDrawer = renderRegistry.registerCodeBlockDrawer(({ draw, state, codeBlock, memoryViews }) => {
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
				unregisterPreparation();
			};
		},
	};
}
