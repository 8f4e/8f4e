import type { EditorPluginContext } from '@8f4e/editor-core';
import {
	applyCodeBlockSourceEdits,
	deleteCodeBlocks,
	getCodeBlockGridWidth,
	removeDirective,
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

	const onCopy = ({ codeBlock }: BlockAction) => {
		const blocks = members(codeBlock).sort((a, b) => a.creationIndex - b.creationIndex);
		if (blocks.length === 0 || !state.callbacks.writeClipboardText) return;
		const text = serializeCodeBlocksToClipboard(blocks, codeBlock);
		state.callbacks.writeClipboardText(text).catch(() => {});
	};
	const onDelete = ({ codeBlock }: BlockAction) => {
		if (state.editorMode !== 'edit') return;
		deleteCodeBlocks(store, members(codeBlock));
	};
	const onRemove = ({ codeBlock }: BlockAction) => {
		if (state.editorMode !== 'edit' || !getGroup(codeBlock.parsedDirectives)) return;
		applyCodeBlockSourceEdits(store, [{ codeBlock, code: removeDirective(codeBlock.code, 'group') }], {
			affectsCompilation: false,
		});
	};
	const onUngroup = ({ codeBlock }: BlockAction) => {
		if (state.editorMode !== 'edit') return;
		const edits = members(codeBlock).map(block => ({ codeBlock: block, code: removeDirective(block.code, 'group') }));
		applyCodeBlockSourceEdits(store, edits, { affectsCompilation: false });
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
		applyCodeBlockSourceEdits(store, edits, { affectsCompilation: false });
	};
	const onSkip = ({ codeBlock }: BlockAction) => {
		if (state.editorMode !== 'edit') return;
		const blocks = members(codeBlock).filter(block => block.blockType === 'module');
		const allSkipped = blocks.every(block => block.code.some(isSkipExecutionDirective));
		const edits = blocks.map(block => ({ codeBlock: block, code: setSkipExecution(block.code, !allSkipped).code }));
		applyCodeBlockSourceEdits(store, edits, { affectsCompilation: true });
	};
	const onAlign = ({ codeBlock }: BlockAction) => {
		if (state.editorMode !== 'edit') return;
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
		const edits: { codeBlock: CodeBlockGraphicData; code: string[] }[] = [];
		for (const [block, x] of positions) {
			if (block.gridX === x && block.gridY === first.gridY) continue;
			block.gridX = x;
			block.gridY = first.gridY;
			block.x = x * state.viewport.vGrid;
			block.y = first.gridY * state.viewport.hGrid;
			edits.push({ codeBlock: block, code: upsertDirective(block.code, 'pos', [String(x), String(first.gridY)]) });
		}
		applyCodeBlockSourceEdits(store, edits, { affectsCompilation: false });
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
