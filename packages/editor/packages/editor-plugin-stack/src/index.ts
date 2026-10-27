import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import drawStack from './drawer/draw';
import { createStackDirective } from './state/directive';
import type { StackLabel } from './types';

export function createStackPlugin({ prefersReducedMotion }: { prefersReducedMotion: () => boolean }): EditorPlugin {
	return {
		id: 'stack',
		setup: ({ store, directives, drawers }) => {
			const state = store.getState();
			const labelsByBlock = new WeakMap<CodeBlockGraphicData, StackLabel[]>();
			const unregisterDirective = directives.register(createStackDirective(labelsByBlock));
			const unregisterDrawer = drawers.registerCodeBlockOverlay(({ draw, codeBlock, memoryViews }) => {
				drawStack(draw, state, labelsByBlock.get(codeBlock) ?? [], performance.now(), prefersReducedMotion());
			});
			return () => {
				unregisterDrawer();
				unregisterDirective();
			};
		},
	};
}
