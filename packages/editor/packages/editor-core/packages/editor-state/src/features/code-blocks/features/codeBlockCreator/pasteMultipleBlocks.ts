import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath, type ProjectGroupPath } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import { getUniqueName } from '../../../../pureHelpers/getUniqueName';
import incrementCompilerInputRevision from '../../../program-compiler/incrementCompilerInputRevision';
import { publishProjectChange } from '../../../project-changes';
import { partitionCodeBlocksByAlwaysOnTop } from '../../partitionCodeBlocksByAlwaysOnTop';
import replaceCodeBlocksInPlace from '../../replaceCodeBlocksInPlace';
import getBlockType from '../../utils/codeParsers/getBlockType';
import { createCodeBlockGraphicData } from '../../utils/createCodeBlockGraphicData';
import getCodeBlockNameFromSource from '../../utils/getCodeBlockNameFromSource';
import { renameInterModuleReferences } from '../../utils/renameInterModuleReferences';
import type { ClipboardCodeBlock } from '../clipboard/clipboardUtils';
import upsertPos from '../directives/pos/upsert';
import { hasDirective } from '../directives/utils';

/**
 * Updates inter-module references in code when pasting multiple blocks.
 * Replaces old module/function names with new ones based on the name mapping.
 * Handles current inter-module reference forms such as &module:memory, module:memory&, module:&, count(module:memory), sizeof(module:memory), max(module:memory), and min(module:memory).
 */
export function updateInterModuleReferences(code: string[], nameMapping: Map<string, string>): string[] {
	if (nameMapping.size === 0) {
		return code;
	}

	let updatedCode = code;
	for (const [oldName, newName] of nameMapping.entries()) {
		updatedCode = renameInterModuleReferences(updatedCode, oldName, newName);
	}

	return updatedCode;
}

function incrementCodeBlockName(name: string): string {
	if (/.*[0-9]+$/gm.test(name)) {
		const [, trailingNumber] = name.match(/.*([0-9]+$)/) as [never, string];
		return name.replace(new RegExp(trailingNumber + '$'), `${parseInt(trailingNumber, 10) + 1}`);
	} else {
		return name + '2';
	}
}

function changeCodeBlockNameInCode(code: string[], instruction: string, name: string): string[] {
	const instructionParser = /^([a-zA-Z][a-zA-Z0-9]*)\s+([a-zA-Z_][a-zA-Z0-9_-]*)/;
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

function createPastedCodeBlock(
	state: State,
	clipboardBlock: ClipboardCodeBlock,
	code: string[],
	gridX: number,
	gridY: number,
	projectPath: ProjectGroupPath
): CodeBlockGraphicData {
	const creationIndex = state.codeBlockRendering.nextCodeBlockCreationIndex;
	state.codeBlockRendering.nextCodeBlockCreationIndex += 1;
	const name = getCodeBlockNameFromSource(code);
	const codeBlock = createCodeBlockGraphicData({
		code,
		name,
		projectPath,
		gridX,
		gridY,
		x: gridX * state.viewport.vGrid,
		y: gridY * state.viewport.hGrid,
		creationIndex,
		blockType: getBlockType(code),
		entry: clipboardBlock.entry,
		disabled: hasDirective(code, 'disabled'),
		alwaysOnTop: hasDirective(code, 'alwaysOnTop'),
	});

	if (clipboardBlock.childProject !== undefined) {
		const childProjectPath = createChildProjectGroupPath(projectPath, name);
		codeBlock.childProject = {
			path: childProjectPath,
			blocks: clipboardBlock.childProject.blocks.map(child => {
				const childGridX = child.gridCoordinates.x;
				const childGridY = child.gridCoordinates.y;
				const childCode = upsertPos([...child.code], childGridX, childGridY);
				return createPastedCodeBlock(state, child, childCode, childGridX, childGridY, childProjectPath);
			}),
		};
	}

	return codeBlock;
}

export interface TransformPastedCodeBlocksEvent {
	/** Plugins replace this batch synchronously, before names and positions are resolved. */
	blocks: ClipboardCodeBlock[];
}

/** Insert a transformed clipboard batch with unique block names and relative positions. */
export function pasteMultipleBlocks(
	store: StateManager<State>,
	events: EventDispatcher,
	{
		x,
		y,
		blocks,
	}: {
		x: number;
		y: number;
		blocks: ClipboardCodeBlock[];
	}
): void {
	const state = store.getState();

	if (state.editorMode !== 'edit') {
		return;
	}
	const projectPath = state.codeBlockRendering.currentProject.path;

	// Calculate paste anchor grid position
	const anchorGridX = Math.round((state.viewport.x + x) / state.viewport.vGrid);
	const anchorGridY = Math.round((state.viewport.y + y) / state.viewport.hGrid);

	const incoming: TransformPastedCodeBlocksEvent = { blocks };
	events.dispatch('transformPastedCodeBlocks', incoming);
	blocks = incoming.blocks;
	const existingProjectGroupNames = new Set(
		state.codeBlockRendering.currentProject.blocks
			.filter(block => block.childProject !== undefined)
			.map(block => block.name)
	);
	const projectGroupNameMapping = new Map<string, string>();
	for (const block of blocks) {
		if (block.childProject === undefined) continue;
		const originalName = getCodeBlockNameFromSource(block.code);
		const newName = getUniqueName(originalName, existingProjectGroupNames);
		projectGroupNameMapping.set(originalName, newName);
		existingProjectGroupNames.add(newName);
	}

	// First pass: determine name mappings for all pasted blocks.
	const nameMapping = new Map<string, string[]>(); // Maps `<type>:<originalName>` to array of new names.
	const processedNames = new Set<string>(); // Track `<type>:<newName>` already assigned.

	// Build list of all original names in order.
	const originalNames: Array<{ type: 'module' | 'function'; name: string; index: number }> = [];
	blocks.forEach((clipboardBlock, index) => {
		const code = [...clipboardBlock.code];
		const blockType = getBlockType(code);
		const blockName = getCodeBlockNameFromSource(code);
		if (blockType === 'function' && blockName) {
			originalNames.push({ type: 'function', name: blockName, index });
		} else if (blockType === 'module' && blockName) {
			originalNames.push({ type: 'module', name: blockName, index });
		}
	});

	// Assign new unique names for each occurrence.
	for (const { type, name: originalName } of originalNames) {
		let newName = originalName;
		while (
			state.codeBlockRendering.currentProject.blocks.some(
				codeBlock =>
					(codeBlock.blockType === type || codeBlock.code[0]?.trim().startsWith(`${type} `)) &&
					codeBlock.name === newName
			) ||
			processedNames.has(`${type}:${newName}`)
		) {
			newName = incrementCodeBlockName(newName);
		}

		const key = `${type}:${originalName}`;
		if (!nameMapping.has(key)) {
			nameMapping.set(key, []);
		}
		nameMapping.get(key)!.push(newName);
		processedNames.add(`${type}:${newName}`);
	}
	const simpleNameMapping = new Map<string, string>();
	for (const [mappingKey, newNameArray] of nameMapping.entries()) {
		const [, originalMappedName] = mappingKey.split(':');
		if (newNameArray.length > 0) {
			simpleNameMapping.set(originalMappedName, newNameArray[0]);
		}
	}

	// Second pass: create blocks with updated names and inter-module references.
	const newBlocks: CodeBlockGraphicData[] = [];
	const occurrenceCounters = new Map<string, number>(); // Track which occurrence we're on for each original name.

	for (const clipboardBlock of blocks) {
		// Calculate absolute grid position
		const gridX = anchorGridX + clipboardBlock.gridCoordinates.x;
		const gridY = anchorGridY + clipboardBlock.gridCoordinates.y;

		// Process code: update names, inter-module references, and rename groups.
		let code = [...clipboardBlock.code];
		const isProjectGroup = clipboardBlock.childProject !== undefined;
		const originalProjectGroupName = isProjectGroup ? getCodeBlockNameFromSource(code) : undefined;
		if (originalProjectGroupName) {
			const newProjectGroupName = projectGroupNameMapping.get(originalProjectGroupName)!;
			code = changeCodeBlockNameInCode(code, 'group', newProjectGroupName);
		}

		// Update module/function names to ensure uniqueness.
		const blockType = getBlockType(code);
		const originalName = getCodeBlockNameFromSource(code);
		const originalType = blockType === 'function' ? 'function' : blockType === 'module' ? 'module' : undefined;

		if (originalName && originalType) {
			const key = `${originalType}:${originalName}`;
			const occurrenceIndex = occurrenceCounters.get(key) || 0;
			occurrenceCounters.set(key, occurrenceIndex + 1);

			const newNames = nameMapping.get(key) || [];
			const newName = newNames[occurrenceIndex] || originalName;

			if (blockType === 'function') {
				code = changeCodeBlockNameInCode(code, 'function', newName);
			} else if (blockType === 'module') {
				code = changeCodeBlockNameInCode(code, 'module', newName);
			}
		}

		if (!isProjectGroup) {
			code = updateInterModuleReferences(code, simpleNameMapping);
			code = updateInterModuleReferences(code, projectGroupNameMapping);
		}
		// Add canonical @pos directive to code
		code = upsertPos(code, gridX, gridY);

		const codeBlock = createPastedCodeBlock(state, clipboardBlock, code, gridX, gridY, projectPath);

		// Add block immediately so next iteration's ID uniqueness check sees it
		state.codeBlockRendering.currentProject.blocks.push(codeBlock);
		newBlocks.push(codeBlock);
	}

	// Stable-sort to maintain the partition: normal blocks first, always-on-top last.
	const sorted = partitionCodeBlocksByAlwaysOnTop(state.codeBlockRendering.currentProject.blocks);

	// Trigger single store update with all new blocks
	replaceCodeBlocksInPlace(state.codeBlockRendering.currentProject.blocks, sorted);
	store.set('codeBlockRendering.currentProject.blocks', state.codeBlockRendering.currentProject.blocks);
	if (newBlocks.length > 0) {
		incrementCompilerInputRevision(store);
		publishProjectChange(store);
	}
}
