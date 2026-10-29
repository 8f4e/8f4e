import type { EditorPluginContext } from '@8f4e/editor-core';
import type { CodeBlockGraphicData, ContextMenuItem } from '@8f4e/editor-state-types';
import { isSkipExecutionDirective } from '@8f4e/tokenizer';
import { type Group, getGroup, getGroupBlocks } from './groups';

export function registerGroupMenus({ store, menus }: EditorPluginContext): () => void {
	const state = store.getState();
	const registerEditingItem = (create: (block: CodeBlockGraphicData, group: Group) => ContextMenuItem | undefined) =>
		menus.registerItem('moduleMenu', ({ codeBlock }) => {
			const group = getGroup(codeBlock);
			return group && state.featureFlags.editing ? create(codeBlock, group) : undefined;
		});
	const unregisterSkip = registerEditingItem(codeBlock => {
		if (codeBlock.blockType !== 'module') return;
		const modules = getGroupBlocks(state, codeBlock).filter(block => block.blockType === 'module');
		const allSkipped = modules.every(block => block.code.some(isSkipExecutionDirective));
		return {
			title: allSkipped ? 'Unskip group' : 'Skip group',
			action: 'toggleGroupSkipExecutionDirective',
			payload: { codeBlock },
			close: true,
		};
	});
	const unregisterAlign = registerEditingItem(codeBlock => ({
		title: 'Align blocks in row',
		action: 'alignGroupBlocksInRow',
		payload: { codeBlock },
		close: true,
	}));
	const unregisterRemove = registerEditingItem(codeBlock => ({
		title: 'Remove from group',
		action: 'removeFromGroupDirective',
		payload: { codeBlock },
		close: true,
	}));
	const unregisterUngroup = registerEditingItem((codeBlock, group) => ({
		title: `Ungroup "${group.name}"`,
		action: 'ungroupByName',
		payload: { codeBlock },
		close: true,
	}));
	const unregisterNonstick = registerEditingItem(codeBlock => {
		const allNonstick = getGroupBlocks(state, codeBlock).every(block => getGroup(block)!.nonstick);
		return {
			title: allNonstick ? 'Make Group Sticky' : 'Make Group Nonstick',
			action: 'toggleGroupNonstick',
			payload: { codeBlock, makeNonstick: !allNonstick },
			close: true,
		};
	});
	const unregisterDelete = registerEditingItem(codeBlock => ({
		title: 'Delete group',
		action: 'deleteGroup',
		payload: { codeBlock },
		close: true,
	}));
	const unregisterCopy = menus.registerItem('moduleMenu', ({ codeBlock }) => {
		if (!getGroup(codeBlock)) return;
		return {
			title: 'Copy group',
			action: 'copyGroupBlocks',
			payload: { codeBlock },
			close: true,
			disabled: !state.callbacks.writeClipboardText,
		};
	});
	return () => {
		unregisterSkip();
		unregisterAlign();
		unregisterRemove();
		unregisterUngroup();
		unregisterNonstick();
		unregisterDelete();
		unregisterCopy();
	};
}
