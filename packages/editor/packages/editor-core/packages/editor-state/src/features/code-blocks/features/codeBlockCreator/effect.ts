import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { DocumentBlockType } from '@8f4e/language-spec';
import { documentBlockInstructionByType } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import { deleteCodeBlocks } from '../../deleteCodeBlocks';
import { insertCodeBlocks } from '../../insertCodeBlocks';
import { applyCodeBlockSourceEdits } from '../../sourceEdits';
import getBlockType from '../../utils/codeParsers/getBlockType';
import getCodeBlockNameFromSource from '../../utils/getCodeBlockNameFromSource';
import upsertDisabled from '../directives/disabled/upsert';
import findEntryNameAtPosition from '../entryBounds/findEntryNameAtPosition';

type NewCodeBlockType = Extract<DocumentBlockType, 'module' | 'function' | 'note' | 'prototype'>;

const moduleBlock = documentBlockInstructionByType.module;
const noteBlock = documentBlockInstructionByType.note;

const nameList = [
	'quark',
	'electron',
	'positron',
	'muon',
	'tau',
	'neutrino',
	'photon',
	'gluon',
	'boson',
	'lepton',
	'axion',
	'curvaton',
	'dilaton',
	'graviton',
	'inflaton',
	'majoron',
	'preon',
	'tachyon',
	'pion',
	'baryon',
	'proton',
	'neutron',
	'nucleon',
	'kaon',
	'meson',
	'hadron',
	'dropleton',
	'anyon',
	'exciton',
	'fracton',
	'magnon',
	'plasmon',
	'polariton',
	'polaron',
	'roton',
	'trion',
];

function getRandomCodeBlockName() {
	return nameList[Math.floor(Math.random() * nameList.length)];
}

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

export default function codeBlockCreator(store: StateManager<State>, events: EventDispatcher): void {
	const state = store.getState();
	function onCreateCodeBlock({ x, y, blockType }: { x: number; y: number; blockType: NewCodeBlockType }): void {
		const block = documentBlockInstructionByType[blockType];
		const name = blockType === noteBlock.type ? '' : ' ' + getRandomCodeBlockName();
		onInsertCodeBlock({ x, y, code: [block.start + name, '', '', block.end] });
	}

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

	function onDeleteCodeBlock({ codeBlock }: { codeBlock: CodeBlockGraphicData }): void {
		if (state.editorMode !== 'edit') {
			return;
		}

		deleteCodeBlocks(store, [codeBlock]);
	}

	function onToggleCodeBlockDisabled({ codeBlock }: { codeBlock: CodeBlockGraphicData }): void {
		if (state.editorMode !== 'edit') {
			return;
		}

		// Toggle disabled state by upserting/removing @disabled directive
		const newDisabledState = !codeBlock.disabled;
		const code = upsertDisabled(codeBlock.code, newDisabledState);
		codeBlock.disabled = newDisabledState;
		applyCodeBlockSourceEdits(store, [{ codeBlock, code }], { affectsCompilation: true });
	}

	events.on('createCodeBlock', onCreateCodeBlock);
	events.on('insertCodeBlock', onInsertCodeBlock);
	events.on('deleteCodeBlock', onDeleteCodeBlock);
	events.on('toggleCodeBlockDisabled', onToggleCodeBlockDisabled);
}
