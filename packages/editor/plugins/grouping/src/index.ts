import type { EditorPlugin } from '@8f4e/editor-core';
import type { ResolveCodeBlockDragTargetsEvent, TransformPastedCodeBlocksEvent } from '@8f4e/editor-state';
import { registerGroupActions } from './actions';
import { getGroup, getGroupBlocks, groupDirective } from './groups';
import { registerGroupMenus } from './menus';
import { renamePastedGroups } from './paste';

export const groupingPlugin: EditorPlugin = {
	id: 'grouping',
	setup: context => {
		const { store, events, directives } = context;
		const state = store.getState();
		const unregisterDirective = directives.register(groupDirective);
		const unregisterActions = registerGroupActions(context);
		const unregisterMenu = registerGroupMenus(context);
		const onDragTargets = (event: ResolveCodeBlockDragTargetsEvent) => {
			const group = getGroup(event.codeBlock);
			if (group && group.nonstick === Boolean(event.altKey)) {
				event.targets = getGroupBlocks(state, event.codeBlock);
			}
		};
		const onPaste = (incoming: TransformPastedCodeBlocksEvent) => renamePastedGroups(incoming, state);
		events.on('resolveCodeBlockDragTargets', onDragTargets);
		events.on('transformPastedCodeBlocks', onPaste);
		return () => {
			events.off('resolveCodeBlockDragTargets', onDragTargets);
			events.off('transformPastedCodeBlocks', onPaste);
			unregisterMenu();
			unregisterActions();
			unregisterDirective();
		};
	},
};
