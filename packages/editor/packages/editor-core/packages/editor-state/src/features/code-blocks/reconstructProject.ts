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
import getHighestProjectBlockId from '../../pureHelpers/projectSerialization/getHighestProjectBlockId';
import { findProjectLevel, walkProjectLevels } from '../../pureHelpers/projectTree';
import { prepareProjectSources } from './sourceUpdates';
import { createCodeBlockGraphicData } from './utils/createCodeBlockGraphicData';
import getCodeBlockNameFromSource from './utils/getCodeBlockNameFromSource';

type ClassifiedProjectBlock = ProjectBlock & {
	blockType: CodeBlockGraphicData['blockType'];
	entry?: string;
};
const collectProjectBlocks = (currentProject: ProjectObjectModel): ClassifiedProjectBlock[] => {
	return [
		...currentProject.functions.map(block => ({ ...block, blockType: 'function' as const })),
		...currentProject.constants.map(block => ({ ...block, blockType: 'constants' as const })),
		...currentProject.includes.map(block => ({ ...block, blockType: 'includes' as const })),
		...currentProject.notes.map(block => ({ ...block, blockType: 'note' as const })),
		...currentProject.unknown.map(block => ({ ...block, blockType: 'unknown' as const })),
	];
};
/** Rebuild the project tree and reconcile remembered views before the effect installs it. */
export function reconstructProject(
	project: ProjectObjectModel,
	environmentId: number,
	directives: EditorDirectiveDefinition[],
	viewport: Pick<Viewport, 'vGrid' | 'hGrid'>,
	previous?: Pick<CodeBlockRendering, 'rootProject' | 'currentProject'>
) {
	const previousLevels = new Map<string, ProjectLevel>();
	const previousBlocks = new Map<string, CodeBlockGraphicData>();
	const previousGroups = new Map<string, CodeBlockGraphicData>();
	const recreatedBlocks = new Map<CodeBlockGraphicData, CodeBlockGraphicData>();
	if (previous) {
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
		const graphicData = createCodeBlockGraphicData({
			code: codeBlock.code,
			name,
			gridX: previousBlock?.gridX ?? 0,
			gridY: previousBlock?.gridY ?? 0,
			creationIndex: codeBlock.id,
			blockType: codeBlock.blockType,
			entry: codeBlock.entry,
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
					// Root serialization needs authored exposures even for groups outside the active view.
					projectMemoryExposures: group.exposures.map(exposure => ({ ...exposure })),
				}
			);
		});
		const projectCodeBlocks = [...projectScopeBlocks, ...codeBlocks, ...executionBlocks];
		const previousLevel = previousLevels.get(projectPath);

		return {
			path: projectPath,
			entries: [...currentProject.entries],
			blocks: projectCodeBlocks,
			viewport: previousLevel?.viewport,
			selectedBlock: previousLevel?.selectedBlock ? recreatedBlocks.get(previousLevel.selectedBlock) : undefined,
		};
	};
	const rootProject = createProjectLevel(project, ROOT_PROJECT_GROUP_PATH);
	// The root environment is generated from configuration of the authored
	// project. Its source metadata is prepared after that configuration settles.
	prepareProjectSources(
		rootProject,
		rootProject.blocks.filter(block => block.creationIndex !== environmentId),
		directives
	);
	for (const level of walkProjectLevels(rootProject)) {
		for (const block of level.blocks) {
			block.x = block.gridX * viewport.vGrid;
			block.y = block.gridY * viewport.hGrid;
		}
	}
	const currentProject = (previous && findProjectLevel(rootProject, previous.currentProject.path)) || rootProject;
	return { rootProject, currentProject, nextCodeBlockCreationIndex };
}
