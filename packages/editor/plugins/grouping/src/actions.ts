import type { EditorPluginContext } from '@8f4e/editor-core';
import {
	applyCodeBlockSourceEdits,
	deleteCodeBlocks,
	removeDirective,
	serializeCodeBlocks,
	setSkipExecution,
	updateDirectiveArgs,
	upsertDirective,
} from '@8f4e/editor-state';
import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import { isSkipExecutionDirective } from '@8f4e/tokenizer';
import { getGroup, getGroupBlocks } from './groups';

type BlockAction = { codeBlock: EditorCodeBlock };

export function registerGroupActions(
	{ store, events }: EditorPluginContext,
	writeClipboardText: (text: string) => Promise<void>
): () => void {
	const state = store.getState();
	const members = (block: EditorCodeBlock) => getGroupBlocks(state, block);

	const onCopy = async ({ codeBlock }: BlockAction) => {
		const blocks = members(codeBlock).sort((a, b) => a.creationIndex - b.creationIndex);
		if (blocks.length === 0) return;
		const text = JSON.stringify(serializeCodeBlocks(blocks, codeBlock));
		await writeClipboardText(text);
	};
	const onDelete = ({ codeBlock }: BlockAction) => {
		if (state.editorMode !== 'edit') return;
		deleteCodeBlocks(store, members(codeBlock));
	};
	const onRemove = ({ codeBlock }: BlockAction) => {
		if (state.editorMode !== 'edit' || !getGroup(codeBlock.parsedDirectives)) return;
		applyCodeBlockSourceEdits(store, [{ codeBlock, code: removeDirective(codeBlock.code, 'group') }]);
	};
	const onUngroup = ({ codeBlock }: BlockAction) => {
		if (state.editorMode !== 'edit') return;
		const edits = members(codeBlock).map(block => ({ codeBlock: block, code: removeDirective(block.code, 'group') }));
		applyCodeBlockSourceEdits(store, edits);
	};
	const onSetNonstick = ({ codeBlock, makeNonstick }: BlockAction & { makeNonstick: boolean }) => {
		if (state.editorMode !== 'edit') return;
		const edits = members(codeBlock).map(block => ({
			codeBlock: block,
			code: updateDirectiveArgs(block.code, 'group', args => {
				const [name] = args;
				return name ? (makeNonstick ? [name, 'nonstick'] : [name]) : args;
			}),
		}));
		applyCodeBlockSourceEdits(store, edits);
	};
	const onSkip = ({ codeBlock }: BlockAction) => {
		if (state.editorMode !== 'edit') return;
		const blocks = members(codeBlock).filter(block => block.blockType === 'module');
		const allSkipped = blocks.every(block => block.code.some(isSkipExecutionDirective));
		const edits = blocks.map(block => ({ codeBlock: block, code: setSkipExecution(block.code, !allSkipped).code }));
		applyCodeBlockSourceEdits(store, edits);
	};
	const onAlign = ({ codeBlock }: BlockAction) => {
		if (state.editorMode !== 'edit' || state.viewport.vGrid <= 0) return;
		const blocks = members(codeBlock).sort((a, b) => a.gridX - b.gridX);
		if (blocks.length < 2) return;
		const [first, ...remaining] = blocks;
		const positions = new Map<EditorCodeBlock, number>();
		let previous = first;
		let previousX = first.gridX;
		for (const block of remaining) {
			const x = previousX + previous.width / state.viewport.vGrid + 4;
			positions.set(block, x);
			previous = block;
			previousX = x;
		}
		const edits: { codeBlock: EditorCodeBlock; code: string[] }[] = [];
		for (const [block, x] of positions) {
			if (block.gridX === x && block.gridY === first.gridY) continue;
			edits.push({ codeBlock: block, code: upsertDirective(block.code, 'pos', [String(x), String(first.gridY)]) });
		}
		applyCodeBlockSourceEdits(store, edits);
	};

	events.on('copyGroupBlocks', onCopy);
	events.on('deleteGroup', onDelete);
	events.on('removeFromGroupDirective', onRemove);
	events.on('ungroupByName', onUngroup);
	events.on('setGroupNonstick', onSetNonstick);
	events.on('toggleGroupSkipExecutionDirective', onSkip);
	events.on('alignGroupBlocksInRow', onAlign);
	return () => {
		events.off('copyGroupBlocks', onCopy);
		events.off('deleteGroup', onDelete);
		events.off('removeFromGroupDirective', onRemove);
		events.off('ungroupByName', onUngroup);
		events.off('setGroupNonstick', onSetNonstick);
		events.off('toggleGroupSkipExecutionDirective', onSkip);
		events.off('alignGroupBlocksInRow', onAlign);
	};
}
