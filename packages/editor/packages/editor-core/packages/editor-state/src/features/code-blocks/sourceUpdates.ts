import type { CodeBlockGraphicData, EditorDirectiveDefinition, ProjectLevel } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath } from '@8f4e/language-spec';
import { updateProjectGroupMemoryExposureDeclarations } from '../../pureHelpers/projectGroupMemoryExposures';
import { updateProjectLevelPath } from '../../pureHelpers/projectTree';
import { getTabStopsByLine } from '../text-geometry/tabLayout';
import parsePos from './features/directives/pos/data';
import { deriveDirectiveFacts } from './features/directives/registry';
import { partitionCodeBlocksByAlwaysOnTop } from './partitionCodeBlocksByAlwaysOnTop';
import type { ProjectMembership } from './projectMembership';
import replaceCodeBlocksInPlace from './replaceCodeBlocksInPlace';
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
export function updateBlockSource(block: CodeBlockGraphicData, directives: EditorDirectiveDefinition[]): void {
	block.parsedDirectives = parseBlockDirectives(block.code);
	const { blockState, displayState } = deriveDirectiveFacts(block.code, block.parsedDirectives, directives);
	block.disabled = blockState.disabled;
	block.alwaysOnTop = blockState.alwaysOnTop;
	block.directiveDisplayState = displayState;
	updateProjectGroupMemoryExposureDeclarations(block);
	block.tabStopsByLine = getTabStopsByLine(block.code.length, block.parsedDirectives);
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
}

function partitionProjectBlocks(project: ProjectLevel): void {
	const sorted = partitionCodeBlocksByAlwaysOnTop(project.blocks);
	if (sorted.some((block, index) => block !== project.blocks[index])) replaceCodeBlocksInPlace(project.blocks, sorted);
}

/** Prepare newly attached source trees, including source-owned stacking in each level. */
export function prepareProjectSources(
	project: ProjectLevel,
	blocks: readonly CodeBlockGraphicData[],
	directives: EditorDirectiveDefinition[]
): void {
	for (const block of blocks) {
		updateBlockSource(block, directives);
		if (block.childProject) prepareProjectSources(block.childProject, block.childProject.blocks, directives);
	}
	partitionProjectBlocks(project);
}

/** Refresh edited blocks without reapplying directives from unchanged child projects. */
export function refreshBlockSources(
	blocks: readonly CodeBlockGraphicData[],
	directives: EditorDirectiveDefinition[],
	membership: Pick<ProjectMembership, 'getOwner'>
): void {
	const projects = new Set<ProjectLevel>();
	for (const block of blocks) {
		updateBlockSource(block, directives);
		const owner = membership.getOwner(block);
		if (owner) projects.add(owner);
	}
	for (const project of projects) partitionProjectBlocks(project);
}
