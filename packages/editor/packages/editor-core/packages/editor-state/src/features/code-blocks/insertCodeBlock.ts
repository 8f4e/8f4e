import type { CodeBlockGraphicData, ProjectEdits, State } from '@8f4e/editor-state-types';
import { documentBlockInstructionByType } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import findEntryNameAtPosition from './features/entryBounds/findEntryNameAtPosition';
import { insertCodeBlocks } from './insertCodeBlocks';
import getBlockType from './utils/codeParsers/getBlockType';
import getCodeBlockNameFromSource from './utils/getCodeBlockNameFromSource';

const moduleBlock = documentBlockInstructionByType.module;

function getUniqueEntryName(state: State): string {
	const usedEntryNames = new Set(
		state.codeBlockRendering.currentProject.blocks
			.filter(block => block.blockType === moduleBlock.type)
			.map(block => block.entry)
	);
	let entryName = 'entry';
	for (let suffix = 2; usedEntryNames.has(entryName); suffix++) entryName = `entry${suffix}`;
	return entryName;
}

/** Insert one block with automatic entry assignment; returns its settled handle, or undefined if no block is inserted. */
export function insertCodeBlock(
	store: Pick<StateManager<State>, 'getState'> & { projectEdits: ProjectEdits },
	{ x, y, code }: { x: number; y: number; code: string[] }
): CodeBlockGraphicData | undefined {
	const state = store.getState();
	if (state.editorMode !== 'edit') return;
	const sourceBlockType = getBlockType(code);
	const blockName = getCodeBlockNameFromSource(code);
	const entry =
		sourceBlockType === moduleBlock.type && blockName
			? (findEntryNameAtPosition(state.codeBlockRendering.entryBounds, state.viewport.x + x, state.viewport.y + y) ??
				getUniqueEntryName(state))
			: undefined;
	return insertCodeBlocks(store, {
		x,
		y,
		blocks: [{ code, gridCoordinates: { x: 0, y: 0 }, entry }],
	})[0];
}
