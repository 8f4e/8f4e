import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath, type ProjectGroupPath } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import type { SerializedCodeBlock } from '../../pureHelpers/codeBlockSerialization';
import incrementCompilerInputRevision from '../program-compiler/incrementCompilerInputRevision';
import { publishProjectChange } from '../project-changes';
import upsertPos from './features/directives/pos/upsert';
import { hasDirective } from './features/directives/utils';
import { partitionCodeBlocksByAlwaysOnTop } from './partitionCodeBlocksByAlwaysOnTop';
import replaceCodeBlocksInPlace from './replaceCodeBlocksInPlace';
import getBlockType from './utils/codeParsers/getBlockType';
import { createCodeBlockGraphicData } from './utils/createCodeBlockGraphicData';
import getCodeBlockNameFromSource from './utils/getCodeBlockNameFromSource';

function createInsertedCodeBlock(
	state: State,
	sourceBlock: SerializedCodeBlock,
	code: string[],
	gridX: number,
	gridY: number,
	projectPath: ProjectGroupPath
): CodeBlockGraphicData {
	const creationIndex = state.codeBlockRendering.nextCodeBlockCreationIndex;
	state.codeBlockRendering.nextCodeBlockCreationIndex += 1;
	const name = getCodeBlockNameFromSource(code);
	const blockType = getBlockType(code);
	const codeBlock = createCodeBlockGraphicData({
		code,
		name,
		projectPath,
		gridX,
		gridY,
		x: gridX * state.viewport.vGrid,
		y: gridY * state.viewport.hGrid,
		creationIndex,
		blockType,
		entry: sourceBlock.entry ?? (blockType === 'module' || sourceBlock.childProject ? 'main' : undefined),
		disabled: hasDirective(code, 'disabled'),
		alwaysOnTop: hasDirective(code, 'alwaysOnTop'),
	});

	if (sourceBlock.childProject !== undefined) {
		const childProjectPath = createChildProjectGroupPath(projectPath, name);
		codeBlock.childProject = {
			path: childProjectPath,
			entries: [...sourceBlock.childProject.entries],
			blocks: sourceBlock.childProject.blocks.map(child => {
				const childGridX = child.gridCoordinates.x;
				const childGridY = child.gridCoordinates.y;
				const childCode = upsertPos([...child.code], childGridX, childGridY);
				return createInsertedCodeBlock(state, child, childCode, childGridX, childGridY, childProjectPath);
			}),
		};
	}

	return codeBlock;
}

/** Insert a source batch into the current project with relative grid positions. */
export function insertCodeBlocks(
	store: Pick<StateManager<State>, 'getState' | 'set'>,
	{
		x,
		y,
		blocks,
	}: {
		x: number;
		y: number;
		blocks: readonly SerializedCodeBlock[];
	}
): void {
	const state = store.getState();

	if (state.editorMode !== 'edit') {
		return;
	}
	const projectPath = state.codeBlockRendering.currentProject.path;

	// Place the source batch relative to the requested viewport position.
	const anchorGridX = Math.round((state.viewport.x + x) / state.viewport.vGrid);
	const anchorGridY = Math.round((state.viewport.y + y) / state.viewport.hGrid);

	const newBlocks: CodeBlockGraphicData[] = [];

	for (const sourceBlock of blocks) {
		// Calculate absolute grid position
		const gridX = anchorGridX + sourceBlock.gridCoordinates.x;
		const gridY = anchorGridY + sourceBlock.gridCoordinates.y;

		const code = upsertPos([...sourceBlock.code], gridX, gridY);

		const codeBlock = createInsertedCodeBlock(state, sourceBlock, code, gridX, gridY, projectPath);

		// Preserve creation order across the inserted batch and its nested projects.
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
