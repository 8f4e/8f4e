import type { EditorPlugin } from '@8f4e/editor-core';
import type { ResolveCodeBlockDragTargetsEvent } from '@8f4e/editor-state';
import { registerGroupActions } from './actions';
import { getGroup, getGroupBlocks } from './groups';
import { registerGroupMenus } from './menus';

export function createGroupingPlugin({
	writeClipboardText,
}: {
	writeClipboardText: (text: string) => Promise<void>;
}): EditorPlugin {
	return {
		id: 'grouping',
		setup: context => {
			const { store, events } = context;
			const state = store.getState();
			const unregisterActions = registerGroupActions(context, writeClipboardText);
			const unregisterMenu = registerGroupMenus(context);
			const onDragTargets = (event: ResolveCodeBlockDragTargetsEvent) => {
				const group = getGroup(event.codeBlock.parsedDirectives);
				if (group && group.nonstick === Boolean(event.altKey)) {
					event.targets = getGroupBlocks(state, event.codeBlock);
				}
			};
			events.on('resolveCodeBlockDragTargets', onDragTargets);
			return () => {
				events.off('resolveCodeBlockDragTargets', onDragTargets);
				unregisterMenu();
				unregisterActions();
			};
		},
	};
}
