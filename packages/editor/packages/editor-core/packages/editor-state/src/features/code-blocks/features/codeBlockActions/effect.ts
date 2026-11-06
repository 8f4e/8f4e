import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import { documentBlockInstructionByType } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import { insertCodeBlocks } from '../../insertCodeBlocks';
import { applyCodeBlockSourceEdits } from '../../sourceEdits';
import getBlockType from '../../utils/codeParsers/getBlockType';
import getCodeBlockNameFromSource from '../../utils/getCodeBlockNameFromSource';
import upsertDisabled from '../directives/disabled/upsert';
import findEntryNameAtPosition from '../entryBounds/findEntryNameAtPosition';

const moduleBlock = documentBlockInstructionByType.module;

function getUniqueEntryName(state: State): string {
	const usedEntryNames = new Set(
		state.codeBlockRendering.currentProject.blocks
			.filter(block => block.blockType === moduleBlock.type)
			.map(block => block.entry)
	);
	let entryName = 'entry';

	for (let suffix = 2; usedEntryNames.has(entryName); suffix++) {
		entryName = `entry${suffix}`;
	}

	return entryName;
}

export default function codeBlockActions(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();
	function onInsertCodeBlock({ x, y, code }: { x: number; y: number; code: string[] }): void {
		if (state.editorMode !== 'edit') return;

		const sourceBlockType = getBlockType(code);
		const blockName = getCodeBlockNameFromSource(code);

		const entry =
			sourceBlockType === moduleBlock.type && blockName
				? (findEntryNameAtPosition(state.codeBlockRendering.entryBounds, state.viewport.x + x, state.viewport.y + y) ??
					getUniqueEntryName(state))
				: undefined;

		insertCodeBlocks(store, {
			x,
			y,
			blocks: [{ code, gridCoordinates: { x: 0, y: 0 }, entry }],
		});
	}

	function onToggleCodeBlockDisabled({ codeBlock }: { codeBlock: CodeBlockGraphicData }): void {
		if (state.editorMode !== 'edit') {
			return;
		}

		// Toggle disabled state by upserting/removing @disabled directive
		const newDisabledState = !codeBlock.disabled;
		const code = upsertDisabled(codeBlock.code, newDisabledState);
		codeBlock.disabled = newDisabledState;
		applyCodeBlockSourceEdits({ store, events }, [{ codeBlock, code }], { affectsCompilation: true });
	}

	events.on('insertCodeBlock', onInsertCodeBlock);
	events.on('toggleCodeBlockDisabled', onToggleCodeBlockDisabled);
	return () => {
		events.off('insertCodeBlock', onInsertCodeBlock);
		events.off('toggleCodeBlockDisabled', onToggleCodeBlockDisabled);
	};
}
