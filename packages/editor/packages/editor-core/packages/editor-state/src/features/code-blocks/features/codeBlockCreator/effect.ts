import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { CompilerSourceBlockType, DocumentBlockType } from '@8f4e/language-spec';
import { documentBlockInstructionByType } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import { instructionParser } from '@8f4e/tokenizer';
import incrementCompilerInputRevision from '../../../program-compiler/incrementCompilerInputRevision';
import { publishProjectChange } from '../../../project-changes';
import { deleteCodeBlocks } from '../../deleteCodeBlocks';
import { insertCodeBlockRespectingAlwaysOnTop } from '../../partitionCodeBlocksByAlwaysOnTop';
import replaceCodeBlocksInPlace from '../../replaceCodeBlocksInPlace';
import { applyCodeBlockSourceEdits } from '../../sourceEdits';
import getBlockType from '../../utils/codeParsers/getBlockType';
import { createCodeBlockGraphicData } from '../../utils/createCodeBlockGraphicData';
import getCodeBlockNameFromSource from '../../utils/getCodeBlockNameFromSource';
import { parseClipboardData, serializeCodeBlocksToClipboard } from '../clipboard/clipboardUtils';
import upsertDisabled from '../directives/disabled/upsert';
import upsertPos from '../directives/pos/upsert';
import { hasDirective } from '../directives/utils';
import findEntryNameAtPosition from '../entryOutlines/findEntryNameAtPosition';
import { findProjectSlicePath } from '../projectGroupNavigation/effect';
import { pasteMultipleBlocks } from './pasteMultipleBlocks';

type NewCodeBlockType = Extract<DocumentBlockType, 'module' | 'function' | 'note' | 'prototype'>;
type RenameableCodeBlockType = Extract<CompilerSourceBlockType, 'module' | 'function' | 'prototype'>;

const functionBlock = documentBlockInstructionByType.function;
const moduleBlock = documentBlockInstructionByType.module;
const noteBlock = documentBlockInstructionByType.note;
const prototypeBlock = documentBlockInstructionByType.prototype;

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

function changeCodeBlockNameInCode(code: string[], instruction: string, name: string) {
	return code.map(line => {
		const match = line.match(instructionParser) as RegExpMatchArray | null;
		if (match && match[1] === instruction && match[2]) {
			// Reconstruct line with new name, preserving spacing and everything after it.
			const beforeInstruction = line.slice(0, match.index!);
			const matchedInstruction = match[1];
			const spacingAfterInstruction = line.slice(
				match.index! + matchedInstruction.length,
				line.indexOf(match[2], match.index!)
			);
			const afterOldId = line.slice(line.indexOf(match[2], match.index!) + match[2].length);
			return beforeInstruction + matchedInstruction + spacingAfterInstruction + name + afterOldId;
		}
		return line;
	});
}

function incrementCodeBlockName(name: string) {
	if (/.*[0-9]+$/gm.test(name)) {
		const [, trailingNumber] = name.match(/.*([0-9]+$)/) as [never, string];
		return name.replace(new RegExp(trailingNumber + '$'), `${parseInt(trailingNumber, 10) + 1}`);
	} else {
		return name + '2';
	}
}

function incrementCodeBlockNameUntilUnique(state: State, blockType: RenameableCodeBlockType, blockName: string) {
	while (
		state.codeBlockRendering.codeBlocks.some(
			codeBlock => codeBlock.blockType === blockType && codeBlock.name === blockName
		)
	) {
		blockName = incrementCodeBlockName(blockName);
	}
	return blockName;
}

function getUniqueEntryName(state: State): string {
	const usedEntryNames = new Set(
		state.codeBlockRendering.codeBlocks.filter(block => block.blockType === moduleBlock.type).map(block => block.entry)
	);
	let entryName = 'entry';

	while (usedEntryNames.has(entryName)) {
		entryName = incrementCodeBlockName(entryName);
	}

	return entryName;
}

function getEntryNameForInsertedModule(state: State, x: number, y: number): string {
	return findEntryNameAtPosition(state.codeBlockRendering.entryOutlines, x, y) ?? getUniqueEntryName(state);
}

export default function codeBlockCreator(store: StateManager<State>, events: EventDispatcher): void {
	const state = store.getState();
	function onCreateCodeBlock({ x, y, blockType }: { x: number; y: number; blockType: NewCodeBlockType }): void {
		const block = documentBlockInstructionByType[blockType];
		const name = blockType === noteBlock.type ? '' : ' ' + getRandomCodeBlockName();
		onInsertCodeBlock({ x, y, code: [block.start + name, '', '', block.end] });
	}

	async function onPasteCodeBlocks({ x, y }: { x: number; y: number }): Promise<void> {
		if (state.editorMode !== 'edit' || !state.callbacks.readClipboardText) return;
		let clipboardText: string;
		try {
			clipboardText = await state.callbacks.readClipboardText();
		} catch {
			return;
		}
		const parsedData = parseClipboardData(clipboardText);
		if (parsedData.type === 'multi') {
			pasteMultipleBlocks(store, events, { x, y, blocks: parsedData.blocks });
		} else {
			onInsertCodeBlock({ x, y, code: parsedData.text.split('\n') });
		}
	}

	function onInsertCodeBlock({ x, y, code }: { x: number; y: number; code: string[] }): void {
		if (state.editorMode !== 'edit') return;

		const sourceBlockType = getBlockType(code);
		const blockName = getCodeBlockNameFromSource(code);

		if (sourceBlockType === functionBlock.type && blockName) {
			code = changeCodeBlockNameInCode(
				code,
				functionBlock.start,
				incrementCodeBlockNameUntilUnique(state, functionBlock.type, blockName)
			);
		} else if (sourceBlockType === prototypeBlock.type && blockName) {
			code = changeCodeBlockNameInCode(
				code,
				prototypeBlock.start,
				incrementCodeBlockNameUntilUnique(state, prototypeBlock.type, blockName)
			);
		} else if (sourceBlockType === moduleBlock.type && blockName) {
			code = changeCodeBlockNameInCode(
				code,
				moduleBlock.start,
				incrementCodeBlockNameUntilUnique(state, moduleBlock.type, blockName)
			);
		}
		const updatedBlockName = getCodeBlockNameFromSource(code);
		const projectPath = findProjectSlicePath(
			state.codeBlockRendering.rootCodeBlocks,
			state.codeBlockRendering.codeBlocks
		)!;

		const creationIndex = state.codeBlockRendering.nextCodeBlockCreationIndex;
		state.codeBlockRendering.nextCodeBlockCreationIndex++;

		// Calculate grid position
		const gridX = Math.round((state.viewport.x + x) / state.viewport.vGrid);
		const gridY = Math.round((state.viewport.y + y) / state.viewport.hGrid);
		const pixelX = state.viewport.x + x;
		const pixelY = state.viewport.y + y;

		// Add canonical @pos directive to code
		code = upsertPos(code, gridX, gridY);
		const entry =
			sourceBlockType === moduleBlock.type && blockName
				? getEntryNameForInsertedModule(state, pixelX, pixelY)
				: undefined;

		const codeBlock: CodeBlockGraphicData = createCodeBlockGraphicData({
			width: 0,
			height: 0,
			code,
			cursor: { col: 0, row: 0, x: 0, y: 0 },
			name: updatedBlockName,
			gridX,
			gridY,
			x: pixelX,
			y: pixelY,
			lineNumberColumnWidth: 2,
			lastUpdated: Date.now(),
			creationIndex,
			blockType: sourceBlockType,
			entry,
			projectPath,
			disabled: false,
			isHome: false,
			alwaysOnTop: hasDirective(code, 'alwaysOnTop'),
		});

		// Insert new block into its z-order partition (normal blocks first, always-on-top last).
		const existingBlocks = state.codeBlockRendering.codeBlocks;
		replaceCodeBlocksInPlace(existingBlocks, insertCodeBlockRespectingAlwaysOnTop(existingBlocks, codeBlock));
		store.set('codeBlockRendering.codeBlocks', existingBlocks);
		incrementCompilerInputRevision(store);
		publishProjectChange(store);
	}

	function onDeleteCodeBlock({ codeBlock }: { codeBlock: CodeBlockGraphicData }): void {
		if (state.editorMode !== 'edit') {
			return;
		}

		deleteCodeBlocks(store, [codeBlock]);
	}

	function onCopyCodeBlock({ codeBlock }: { codeBlock: CodeBlockGraphicData }): void {
		// Use callback if available, otherwise fail silently
		if (state.callbacks.writeClipboardText) {
			const clipboardText =
				codeBlock.nestedProjectCodeBlocks === undefined
					? codeBlock.code.join('\n')
					: serializeCodeBlocksToClipboard([codeBlock], codeBlock);
			state.callbacks.writeClipboardText(clipboardText).catch(() => {
				// Fail silently if clipboard write fails
				return undefined;
			});
		}
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
	events.on('pasteCodeBlocks', onPasteCodeBlocks);
	events.on('insertCodeBlock', onInsertCodeBlock);
	events.on('copyCodeBlock', onCopyCodeBlock);
	events.on('deleteCodeBlock', onDeleteCodeBlock);
	events.on('toggleCodeBlockDisabled', onToggleCodeBlockDisabled);
}
