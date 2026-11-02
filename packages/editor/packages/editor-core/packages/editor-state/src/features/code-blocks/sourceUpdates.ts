import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import { updateProjectLevelPath } from '../../pureHelpers/projectTree';
import resolveEditorConfig from '../global-editor-directives/resolve';
import { updateEnvConstantsBlock } from './features/auto-env-constants/effect';
import parsePos from './features/directives/pos/data';
import getBlockType from './utils/codeParsers/getBlockType';
import getCodeBlockNameFromSource from './utils/getCodeBlockNameFromSource';
import { parseBlockDirectives } from './utils/parseBlockDirectives';

function isProjectScopeSourceLine(line: string): boolean {
	const trimmed = line.trim();
	return (
		trimmed === '' ||
		trimmed.startsWith(';') ||
		trimmed.startsWith('#') ||
		trimmed.startsWith('//') ||
		/^pass(?:\s|$)/.test(trimmed)
	);
}

/** Refresh source-owned metadata without clearing the last valid position during incomplete edits. */
export function updateBlockSource(block: CodeBlockGraphicData): void {
	block.parsedDirectives = parseBlockDirectives(block.code);
	const previousName = block.name;
	block.name = getCodeBlockNameFromSource(block.code);
	if (block.childProject !== undefined && block.name !== previousName) {
		updateProjectLevelPath(block.childProject, createChildProjectGroupPath(block.projectPath, block.name));
	}
	const position = parsePos(block.parsedDirectives);
	if (position) {
		block.gridX = position.x;
		block.gridY = position.y;
	}
	block.blockType = getBlockType(block.code);
	const hasProjectScopeInstruction = block.code.some(line => /^\s*pass(?:\s|$)/.test(line));
	block.isProjectScope =
		block.projectPath === '' &&
		block.childProject === undefined &&
		block.blockType === 'unknown' &&
		block.code.every(isProjectScopeSourceLine) &&
		(hasProjectScopeInstruction || block.isProjectScope === true);
	for (const child of block.childProject?.blocks ?? []) updateBlockSource(child);
}

/** One source-update path: metadata, generated environment source, global configuration, then layout. */
export function refreshBlockSources(
	store: StateManager<State>,
	blocks: readonly CodeBlockGraphicData[],
	refreshLayouts: () => void
): void {
	for (const block of blocks) updateBlockSource(block);
	updateEnvConstantsBlock(store);
	resolveEditorConfig(store);
	refreshLayouts();
}
