import type {
	CodeBlockGraphicData,
	CodeBlockRendering,
	EditorDirectiveDefinition,
	ProjectLevel,
	Viewport,
} from '@8f4e/editor-state-types';
import {
	createChildProjectGroupPath,
	type ProjectBlock,
	type ProjectGroupPath,
	type ProjectObjectModel,
	ROOT_PROJECT_GROUP_PATH,
} from '@8f4e/language-spec';
import { findProjectLevel, walkProjectLevels } from '../../pureHelpers/projectTree';
import parsePos from './features/directives/pos/data';
import { deriveDirectiveState } from './features/directives/registry';
import { partitionCodeBlocksByAlwaysOnTop } from './partitionCodeBlocksByAlwaysOnTop';
import { createCodeBlockGraphicData } from './utils/createCodeBlockGraphicData';
import getCodeBlockNameFromSource from './utils/getCodeBlockNameFromSource';
import { parseBlockDirectives } from './utils/parseBlockDirectives';

type ClassifiedProjectBlock = ProjectBlock & {
	blockType: CodeBlockGraphicData['blockType'];
	entry?: string;
};
const collectProjectBlocks = (currentProject: ProjectObjectModel): ClassifiedProjectBlock[] => {
	return [
		...currentProject.functions.map(block => ({ ...block, blockType: 'function' as const })),
		...currentProject.constants.map(block => ({ ...block, blockType: 'constants' as const })),
		...currentProject.prototypes.map(block => ({ ...block, blockType: 'prototype' as const })),
		...currentProject.includes.map(block => ({ ...block, blockType: 'includes' as const })),
		...currentProject.notes.map(block => ({ ...block, blockType: 'note' as const })),
		...currentProject.unknown.map(block => ({ ...block, blockType: 'unknown' as const })),
	];
};
const getHighestProjectBlockId = (currentProject: ProjectObjectModel): number =>
	Math.max(
		-1,
		...collectProjectBlocks(currentProject).map(block => block.id),
		...currentProject.execution.map(block =>
			block.type === 'group' ? Math.max(block.id, getHighestProjectBlockId(block)) : block.id
		)
	);

/** Rebuild the project tree and reconcile remembered views before the effect installs it. */
export function reconstructProject(
	project: ProjectObjectModel,
	directives: EditorDirectiveDefinition[],
	viewport: Pick<Viewport, 'x' | 'y' | 'vGrid' | 'hGrid'>,
	previous?: Pick<CodeBlockRendering, 'rootProject' | 'currentProject' | 'selectedCodeBlock'>
) {
	const previousLevels = new Map<string, ProjectLevel>();
	const previousBlocks = new Map<string, CodeBlockGraphicData>();
	const previousGroups = new Map<string, CodeBlockGraphicData>();
	const recreatedBlocks = new Map<CodeBlockGraphicData, CodeBlockGraphicData>();
	if (previous) {
		const previousCurrent = previous.currentProject;
		previousCurrent.viewport = { x: viewport.x, y: viewport.y };
		previousCurrent.selectedBlock = previous.selectedCodeBlock;
		for (const level of walkProjectLevels(previous.rootProject)) {
			previousLevels.set(level.path, level);
			for (const block of level.blocks) {
				if (block.childProject) previousGroups.set(block.childProject.path, block);
				else {
					const key = block.isProjectScope ? 'project-scope' : JSON.stringify([block.projectPath, block.creationIndex]);
					previousBlocks.set(key, block);
				}
			}
		}
	}
	let nextCodeBlockCreationIndex = getHighestProjectBlockId(project) + 1;

	const createGraphicCodeBlock = (
		codeBlock: ClassifiedProjectBlock,
		overrides: Partial<CodeBlockGraphicData> = {}
	): CodeBlockGraphicData => {
		// Same-project edits retain an existing position while their source is incomplete.
		const projectPath = overrides.projectPath ?? ROOT_PROJECT_GROUP_PATH;
		const name = overrides.name ?? getCodeBlockNameFromSource(codeBlock.code);
		const previousBlock =
			overrides.childProject !== undefined
				? previousGroups.get(createChildProjectGroupPath(projectPath, name))
				: previousBlocks.get(overrides.isProjectScope ? 'project-scope' : JSON.stringify([projectPath, codeBlock.id]));
		const blockParsedDirectives = parseBlockDirectives(codeBlock.code);
		const posResult = parsePos(blockParsedDirectives);
		const gridX = posResult ? posResult.x : previousBlock ? previousBlock.gridX : 0;
		const gridY = posResult ? posResult.y : previousBlock ? previousBlock.gridY : 0;
		const directiveState = deriveDirectiveState(codeBlock.code, blockParsedDirectives, {}, directives);

		// For viewport-anchored blocks, x/y will be resolved after block derivation sets
		// width/height; initialize to 0 here as a safe placeholder.
		const isAnchored = directiveState.blockState.viewportAnchor !== undefined;
		const pixelX = isAnchored ? 0 : gridX * viewport.vGrid;
		const pixelY = isAnchored ? 0 : gridY * viewport.hGrid;

		const graphicData = createCodeBlockGraphicData({
			width: 0,
			height: 0,
			code: codeBlock.code,
			cursor: { col: 0, row: 0, y: 0 },
			name,
			gridX,
			gridY,
			x: pixelX,
			y: pixelY,
			lineNumberColumnWidth: 1,
			creationIndex: codeBlock.id,
			blockType: codeBlock.blockType,
			entry: codeBlock.entry,
			disabled: codeBlock.disabled ?? directiveState.blockState.disabled,
			isHome: directiveState.blockState.isHome,
			homeAlignment: directiveState.blockState.homeAlignment,
			alwaysOnTop: directiveState.blockState.alwaysOnTop ?? false,
			viewportAnchor: directiveState.blockState.viewportAnchor,
			parsedDirectives: blockParsedDirectives,
			...overrides,
		});
		if (previousBlock) recreatedBlocks.set(previousBlock, graphicData);
		return graphicData;
	};
	const createProjectLevel = (currentProject: ProjectObjectModel, projectPath: ProjectGroupPath): ProjectLevel => {
		const projectScopeBlocks =
			projectPath === ROOT_PROJECT_GROUP_PATH && currentProject.code.length > 0
				? [
						createGraphicCodeBlock(
							{
								id: nextCodeBlockCreationIndex++,
								code: currentProject.code,
								blockType: 'unknown',
							},
							{ projectPath, isProjectScope: true }
						),
					]
				: [];
		const codeBlocks = collectProjectBlocks(currentProject).map(codeBlock =>
			createGraphicCodeBlock(codeBlock, { projectPath })
		);
		const executionBlocks = currentProject.execution.map(block => {
			if (block.type === 'module') {
				return createGraphicCodeBlock({ ...block, blockType: 'module' }, { projectPath });
			}
			const group = block;
			const groupName = group.name;
			return createGraphicCodeBlock(
				{
					id: group.id,
					code: [...group.code],
					blockType: 'unknown',
					entry: group.entry,
				},
				{
					name: groupName,
					projectPath,
					childProject: createProjectLevel(group, createChildProjectGroupPath(projectPath, groupName)),
				}
			);
		});
		const projectCodeBlocks = [...projectScopeBlocks, ...codeBlocks, ...executionBlocks];
		const previousLevel = previousLevels.get(projectPath);

		// Stable-sort to maintain the partition: normal blocks first, always-on-top last.
		return {
			path: projectPath,
			entries: [...currentProject.entries],
			blocks: partitionCodeBlocksByAlwaysOnTop(projectCodeBlocks),
			viewport: previousLevel?.viewport,
			selectedBlock: previousLevel?.selectedBlock ? recreatedBlocks.get(previousLevel.selectedBlock) : undefined,
		};
	};
	const rootProject = createProjectLevel(project, ROOT_PROJECT_GROUP_PATH);
	const currentProject = (previous && findProjectLevel(rootProject, previous.currentProject.path)) || rootProject;
	return { rootProject, currentProject, nextCodeBlockCreationIndex };
}
