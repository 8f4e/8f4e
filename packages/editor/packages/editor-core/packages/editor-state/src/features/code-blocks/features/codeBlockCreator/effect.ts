import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { CompilerSourceBlockType, DocumentBlockType } from '@8f4e/language-spec';
import { documentBlockInstructionByType } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import { instructionParser } from '@8f4e/tokenizer';
import incrementCompilerInputRevision from '../../../program-compiler/incrementCompilerInputRevision';
import incrementProjectRevision from '../../../program-compiler/incrementProjectRevision';
import { insertCodeBlockRespectingAlwaysOnTop } from '../../partitionCodeBlocksByAlwaysOnTop';
import replaceCodeBlocksInPlace from '../../replaceCodeBlocksInPlace';
import getBlockType from '../../utils/codeParsers/getBlockType';
import { createCodeBlockGraphicData } from '../../utils/createCodeBlockGraphicData';
import getCodeBlockNameFromSource from '../../utils/getCodeBlockNameFromSource';
import { parseClipboardData, serializeCodeBlocksToClipboard } from '../clipboard/clipboardUtils';
import upsertDisabled from '../directives/disabled/upsert';
import upsertPos from '../directives/pos/upsert';
import { hasDirective } from '../directives/utils';
import findEntryNameAtPosition from '../entryOutlines/findEntryNameAtPosition';
import { findProjectSlicePath } from '../projectGroupNavigation/effect';
import extractPublicBlockFromModuleSource from './extractPublicBlockFromModuleSource';
import { insertDependencies } from './insertDependencies';
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
			codeBlock =>
				(codeBlock.blockType === blockType || codeBlock.code[0]?.trim().startsWith(`${blockType} `)) &&
				codeBlock.name === blockName
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

function getEntryNameForNewModule(state: State, x: number, y: number, newEntry?: boolean): string {
	return newEntry
		? getUniqueEntryName(state)
		: (findEntryNameAtPosition(state.codeBlockRendering.entryOutlines, x, y) ?? getUniqueEntryName(state));
}

export default function codeBlockCreator(store: StateManager<State>, events: EventDispatcher): void {
	const state = store.getState();
	async function onAddCodeBlock({
		x,
		y,
		isNew,
		blockType,
		newEntry,
		code = [''],
	}: {
		x: number;
		y: number;
		isNew: boolean;
		blockType?: NewCodeBlockType;
		newEntry?: boolean;
		code?: string[];
	}) {
		if (!state.featureFlags.editing) {
			return;
		}

		const hasExplicitCode = code.length > 1 || (code.length === 1 && code[0].trim().length > 0);

		if (isNew && !hasExplicitCode) {
			if (blockType === functionBlock.type) {
				code = [functionBlock.start + ' ' + getRandomCodeBlockName(), '', '', functionBlock.end];
			} else if (blockType === prototypeBlock.type) {
				code = [prototypeBlock.start + ' ' + getRandomCodeBlockName(), '', '', prototypeBlock.end];
			} else if (blockType === noteBlock.type) {
				code = [noteBlock.start, '', '', noteBlock.end];
			} else {
				code = [moduleBlock.start + ' ' + getRandomCodeBlockName(), '', '', moduleBlock.end];
			}
		} else if (code.length < 2) {
			// If no callback is provided, fail silently
			if (!state.callbacks.readClipboardText) {
				return;
			}

			try {
				const clipboardText = await state.callbacks.readClipboardText();
				const parsedData = parseClipboardData(clipboardText);

				if (parsedData.type === 'multi') {
					// Multi-block paste
					pasteMultipleBlocks(store, { x, y, blocks: parsedData.blocks });
					return;
				} else {
					// Single-block paste
					code = parsedData.text.split('\n');
				}
			} catch {
				// Fail silently if clipboard read fails
				return;
			}
		}

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
				? getEntryNameForNewModule(state, pixelX, pixelY, newEntry)
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
			blockType: 'unknown', // Will be updated by blockTypeUpdater effect
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
		incrementProjectRevision(store);
	}

	function onDeleteCodeBlock({ codeBlock }: { codeBlock: CodeBlockGraphicData }): void {
		if (!state.featureFlags.editing) {
			return;
		}

		const codeBlocks = state.codeBlockRendering.codeBlocks;
		const codeBlockExists = codeBlocks.includes(codeBlock);
		replaceCodeBlocksInPlace(
			codeBlocks,
			codeBlocks.filter(block => block !== codeBlock)
		);
		store.set('codeBlockRendering.codeBlocks', codeBlocks);
		if (codeBlockExists) {
			incrementCompilerInputRevision(store);
			incrementProjectRevision(store);
		}
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
		if (!state.featureFlags.editing) {
			return;
		}

		// Toggle disabled state by upserting/removing @disabled directive
		const newDisabledState = !codeBlock.disabled;
		codeBlock.code = upsertDisabled(codeBlock.code, newDisabledState);
		codeBlock.disabled = newDisabledState;
		// Update lastUpdated to invalidate cache
		codeBlock.lastUpdated = Date.now();
		// Use selectedCodeBlockForProgrammaticEdit to trigger graphics update
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', codeBlock);
		incrementCompilerInputRevision(store);
		incrementProjectRevision(store);
	}

	async function onAddCodeBlockBySlug({
		codeBlockSlug,
		x,
		y,
	}: {
		codeBlockSlug: string;
		x: number;
		y: number;
	}): Promise<void> {
		if (!state.callbacks.getModule) {
			console.warn('No getCodeBlock callback provided');
			return;
		}

		// Load the requested module
		const requestedModuleCodeText = await state.callbacks.getModule(codeBlockSlug);

		// Add the requested module at the clicked position
		const requestedCode = extractPublicBlockFromModuleSource(requestedModuleCodeText);
		onAddCodeBlock({ code: requestedCode, x, y, isNew: false });

		// If the module has dependencies, insert them to the right
		const dependencies = state.callbacks.getModuleDependencies
			? await state.callbacks.getModuleDependencies(codeBlockSlug)
			: [];
		if (dependencies.length > 0) {
			await insertDependencies({
				dependencies,
				getModule: state.callbacks.getModule,
				requestedModuleCode: requestedCode,
				clickX: x,
				clickY: y,
				state,
				onAddCodeBlock,
			});
		}
	}

	events.on('addCodeBlockBySlug', onAddCodeBlockBySlug);
	events.on('addCodeBlock', onAddCodeBlock);
	events.on('copyCodeBlock', onCopyCodeBlock);
	events.on('deleteCodeBlock', onDeleteCodeBlock);
	events.on('toggleCodeBlockDisabled', onToggleCodeBlockDisabled);
}
