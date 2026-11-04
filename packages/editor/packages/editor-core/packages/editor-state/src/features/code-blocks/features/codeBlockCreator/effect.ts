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

/** Plugins may choose an insertion entry using the requested world-space position. */
export interface ResolveCodeBlockInsertionEntryEvent {
	x: number;
	y: number;
	entry: string;
}

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

function incrementEntryName(name: string) {
	if (/.*[0-9]+$/gm.test(name)) {
		const [, trailingNumber] = name.match(/.*([0-9]+$)/) as [never, string];
		return name.replace(new RegExp(trailingNumber + '$'), `${parseInt(trailingNumber, 10) + 1}`);
	} else {
		return name + '2';
	}
}

function getUniqueEntryName(state: State): string {
	const usedEntryNames = new Set(
		state.codeBlockRendering.currentProject.blocks
			.filter(block => block.blockType === moduleBlock.type)
			.map(block => block.entry)
	);
	let entryName = 'entry';

	while (usedEntryNames.has(entryName)) {
		entryName = incrementEntryName(entryName);
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

		let entry: string | undefined;
		if (sourceBlockType === moduleBlock.type && blockName) {
			const request: ResolveCodeBlockInsertionEntryEvent = {
				x: state.viewport.x + x,
				y: state.viewport.y + y,
				entry: getUniqueEntryName(state),
			};
			events.dispatch('resolveCodeBlockInsertionEntry', request);
			entry = request.entry;
		}

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
