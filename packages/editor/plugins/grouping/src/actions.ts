import type { EditorPluginContext } from '@8f4e/editor-core';
import {
	getCodeBlockGridWidth,
	incrementCompilerInputRevision,
	publishProjectChange,
	removeDirective,
	replaceCodeBlocksInPlace,
	serializeCodeBlocksToClipboard,
	setSkipExecution,
	updateDirectiveArgs,
	upsertDirective,
} from '@8f4e/editor-state';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { isSkipExecutionDirective } from '@8f4e/tokenizer';
import { getGroup, getGroupBlocks } from './groups';

type BlockAction = { codeBlock: CodeBlockGraphicData };

export function registerGroupActions({ store, events }: EditorPluginContext): () => void {
	const state = store.getState();
	const members = (block: CodeBlockGraphicData) => getGroupBlocks(state, block);
	const commitCode = (block: CodeBlockGraphicData, code: string[]): boolean => {
		if (code.length === block.code.length && code.every((line, index) => line === block.code[index])) return false;
		block.code = code;
		block.lastUpdated = Date.now();
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', block);
		return true;
	};

	const onCopy = ({ codeBlock }: BlockAction) => {
		const blocks = members(codeBlock).sort((a, b) => a.creationIndex - b.creationIndex);
		if (blocks.length === 0 || !state.callbacks.writeClipboardText) return;
		const text = serializeCodeBlocksToClipboard(blocks, codeBlock);
		state.callbacks.writeClipboardText(text).catch(() => {});
	};
	const onDelete = ({ codeBlock }: BlockAction) => {
		if (!state.featureFlags.editing) return;
		const removed = new Set(members(codeBlock));
		if (removed.size === 0) return;
		const rendering = state.codeBlockRendering;
		if (rendering.selectedCodeBlock && removed.has(rendering.selectedCodeBlock)) {
			store.set('codeBlockRendering.selectedCodeBlock', undefined);
		}
		if (rendering.draggedCodeBlock && removed.has(rendering.draggedCodeBlock)) rendering.draggedCodeBlock = undefined;
		if (rendering.selectedCodeBlockForProgrammaticEdit && removed.has(rendering.selectedCodeBlockForProgrammaticEdit)) {
			rendering.selectedCodeBlockForProgrammaticEdit = undefined;
		}
		replaceCodeBlocksInPlace(
			rendering.codeBlocks,
			rendering.codeBlocks.filter(block => !removed.has(block))
		);
		store.set('codeBlockRendering.codeBlocks', rendering.codeBlocks);
		incrementCompilerInputRevision(store);
		publishProjectChange(store);
	};
	const onRemove = ({ codeBlock }: BlockAction) => {
		if (!state.featureFlags.editing || !getGroup(codeBlock.parsedDirectives)) return;
		if (commitCode(codeBlock, removeDirective(codeBlock.code, 'group'))) publishProjectChange(store);
	};
	const onUngroup = ({ codeBlock }: BlockAction) => {
		if (!state.featureFlags.editing) return;
		let changed = false;
		for (const block of members(codeBlock)) {
			changed = commitCode(block, removeDirective(block.code, 'group')) || changed;
		}
		if (changed) publishProjectChange(store);
	};
	const onNonstick = ({ codeBlock, makeNonstick }: BlockAction & { makeNonstick: boolean }) => {
		if (!state.featureFlags.editing) return;
		let changed = false;
		for (const block of members(codeBlock)) {
			const code = updateDirectiveArgs(block.code, 'group', args => {
				const [name] = args;
				return name ? (makeNonstick ? [name, 'nonstick'] : [name]) : args;
			});
			changed = commitCode(block, code) || changed;
		}
		if (changed) publishProjectChange(store);
	};
	const onSkip = ({ codeBlock }: BlockAction) => {
		if (!state.featureFlags.editing) return;
		const blocks = members(codeBlock).filter(block => block.blockType === 'module');
		const allSkipped = blocks.every(block => block.code.some(isSkipExecutionDirective));
		let changed = false;
		for (const block of blocks) {
			const result = setSkipExecution(block.code, !allSkipped);
			if (result.changed) changed = commitCode(block, result.code) || changed;
		}
		if (changed) {
			incrementCompilerInputRevision(store);
			publishProjectChange(store);
		}
	};
	const onAlign = ({ codeBlock }: BlockAction) => {
		if (!state.featureFlags.editing) return;
		const blocks = members(codeBlock).sort((a, b) => a.gridX - b.gridX);
		if (blocks.length < 2) return;
		const [first, ...remaining] = blocks;
		const positions = new Map<CodeBlockGraphicData, number>();
		let previous = first;
		let previousX = first.gridX;
		for (const block of remaining) {
			const x = previousX + getCodeBlockGridWidth(previous.code, previous.minGridWidth) + 4;
			positions.set(block, x);
			previous = block;
			previousX = x;
		}
		let changed = false;
		for (const [block, x] of positions) {
			if (block.gridX === x && block.gridY === first.gridY) continue;
			block.gridX = x;
			block.gridY = first.gridY;
			block.x = x * state.viewport.vGrid;
			block.y = first.gridY * state.viewport.hGrid;
			commitCode(block, upsertDirective(block.code, 'pos', [String(x), String(first.gridY)]));
			changed = true;
		}
		if (changed) publishProjectChange(store);
	};

	events.on('copyGroupBlocks', onCopy);
	events.on('deleteGroup', onDelete);
	events.on('removeFromGroupDirective', onRemove);
	events.on('ungroupByName', onUngroup);
	events.on('toggleGroupNonstick', onNonstick);
	events.on('toggleGroupSkipExecutionDirective', onSkip);
	events.on('alignGroupBlocksInRow', onAlign);
	return () => {
		events.off('copyGroupBlocks', onCopy);
		events.off('deleteGroup', onDelete);
		events.off('removeFromGroupDirective', onRemove);
		events.off('ungroupByName', onUngroup);
		events.off('toggleGroupNonstick', onNonstick);
		events.off('toggleGroupSkipExecutionDirective', onSkip);
		events.off('alignGroupBlocksInRow', onAlign);
	};
}
