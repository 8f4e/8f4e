import type {
	CodeBlockGraphicData,
	CodeBlockRendering,
	EditorDirectiveDefinition,
	EditorLevelSnapshot,
	EditorProjectSnapshot,
	ProjectLevel,
	Viewport,
} from '@8f4e/editor-state-types';
import { findProjectLevel, walkProjectLevels } from '../../pureHelpers/projectTree';
import { prepareProjectSources } from './sourceUpdates';
import { createCodeBlockGraphicData } from './utils/createCodeBlockGraphicData';
import getCodeBlockNameFromSource from './utils/getCodeBlockNameFromSource';

/** Rebuild editor source and reconcile remembered views without taking source facts from the outgoing view. */
export function reconstructProject(
	snapshot: EditorProjectSnapshot,
	directives: EditorDirectiveDefinition[],
	viewport: Pick<Viewport, 'vGrid' | 'hGrid'>,
	previous?: CodeBlockRendering
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
				else previousBlocks.set(JSON.stringify([block.projectPath, block.creationIndex]), block);
			}
		}
	}
	const createProjectLevel = (level: EditorLevelSnapshot): ProjectLevel => {
		const blocks = level.blocks.map(block => {
			const code = [...block.code];
			const graphicData = createCodeBlockGraphicData({
				code,
				name: getCodeBlockNameFromSource(code),
				projectPath: level.path,
				creationIndex: block.creationIndex,
				entry: block.entry,
				gridX: block.gridX,
				gridY: block.gridY,
				isProjectScope: block.isProjectScope,
				childProject: block.childProject ? createProjectLevel(block.childProject) : undefined,
			});
			const previousBlock = block.childProject
				? previousGroups.get(block.childProject.path)
				: previousBlocks.get(JSON.stringify([level.path, block.creationIndex]));
			if (previousBlock) recreatedBlocks.set(previousBlock, graphicData);
			return graphicData;
		});
		const previousLevel = previousLevels.get(level.path);

		return {
			path: level.path,
			entries: [...level.entries],
			blocks,
			viewport: previousLevel?.viewport,
			selectedBlock: previousLevel?.selectedBlock ? recreatedBlocks.get(previousLevel.selectedBlock) : undefined,
		};
	};
	const rootProject = createProjectLevel(snapshot.rootProject);
	prepareProjectSources(rootProject, rootProject.blocks, directives);
	for (const level of walkProjectLevels(rootProject)) {
		for (const block of level.blocks) {
			block.x = block.gridX * viewport.vGrid;
			block.y = block.gridY * viewport.hGrid;
		}
	}
	const currentProject = (previous && findProjectLevel(rootProject, previous.currentProject.path)) || rootProject;
	const nextCodeBlockCreationIndex = Math.max(
		snapshot.nextCodeBlockCreationIndex,
		previous?.nextCodeBlockCreationIndex ?? 0
	);
	return { rootProject, currentProject, nextCodeBlockCreationIndex };
}
