import type { CodeBlockGraphicData, EditorDirectiveDefinition, ProjectLevel } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath } from '@8f4e/language-spec';
import parsePos from '../../directives/block/positionDirective';
import { deriveDirectiveFacts } from '../../directives/blockDirectiveRegistry';
import { parseBlockDirectives } from '../../directives/parseBlockDirectives';
import { clampSourcePosition } from '../../layout/text-geometry/clampSourcePosition';
import { getTabStopsByLine } from '../../layout/text-geometry/tabLayout';
import { updateProjectGroupMemoryExposureDeclarations } from '../../memory/projectGroupMemoryExposures';
import type { ProjectMembership } from '../membership';
import { updateProjectLevelPath } from '../tree';
import getCodeBlockNameFromSource from './getCodeBlockNameFromSource';
import getBlockType from './getCodeBlockTypeFromSource';
import replaceCodeBlocksInPlace from './replaceBlocksInPlace';
import { partitionCodeBlocksByAlwaysOnTop } from './zOrder';

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

/** Modules and structural project-group blocks can own execution entries. */
export function supportsExecutionEntry(block: Pick<CodeBlockGraphicData, 'blockType' | 'childProject'>): boolean {
	return block.blockType === 'module' || block.childProject !== undefined;
}

/** Keep the editor's entry table authoritative, including empty previously declared entries. */
export function rememberEntry(project: ProjectLevel, block: CodeBlockGraphicData): void {
	if (supportsExecutionEntry(block) && block.entry !== undefined && !project.entries.includes(block.entry)) {
		project.entries.push(block.entry);
	}
}

/** Refresh source-owned metadata without clearing the last valid position during incomplete edits. */
export function updateBlockSource(block: CodeBlockGraphicData, directives: EditorDirectiveDefinition[]): void {
	const [row, col] = clampSourcePosition(block.code, block.cursor.row, block.cursor.col);
	block.cursor.row = row;
	block.cursor.col = col;
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
	// Unknown source may be an incomplete module rather than a conversion. Keep its
	// last entry until the user finishes declaring a non-execution block.
	if (supportsExecutionEntry(block)) {
		block.entry ??= 'main';
	} else if (block.isProjectScope || block.blockType !== 'unknown') {
		block.entry = undefined;
	}
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
		rememberEntry(project, block);
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
