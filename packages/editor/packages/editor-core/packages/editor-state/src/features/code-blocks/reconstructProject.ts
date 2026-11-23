import type {
	CodeBlockGraphicData,
	CodeBlockRendering,
	EditorDirectiveDefinition,
	EditorLevelSnapshot,
	EditorProjectSnapshot,
	ProjectLevel,
	Viewport,
} from '@8f4e/editor-state-types';
import { walkProjectLevels } from '../../pureHelpers/projectTree';
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
	let currentProject: ProjectLevel | undefined;
	const createProjectLevel = (level: EditorLevelSnapshot, previousLevel?: ProjectLevel): ProjectLevel => {
		// IDs are stable within a project's own block collection. Follow owning
		// blocks rather than names, which may change or be duplicated while editing.
		const previousBlocks = new Map(previousLevel?.blocks.map(block => [block.creationIndex, block]));
		let selectedBlock: CodeBlockGraphicData | undefined;
		const blocks = level.blocks.map(block => {
			const previousBlock = previousBlocks.get(block.creationIndex);
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
				childProject: block.childProject
					? createProjectLevel(block.childProject, previousBlock?.childProject)
					: undefined,
			});
			if (previousBlock && previousBlock === previousLevel?.selectedBlock) selectedBlock = graphicData;
			return graphicData;
		});
		const project: ProjectLevel = {
			path: level.path,
			entries: [...level.entries],
			blocks,
			viewport: previousLevel?.viewport,
			selectedBlock,
		};
		if (previousLevel && previousLevel === previous?.currentProject) currentProject = project;
		return project;
	};
	const rootProject = createProjectLevel(snapshot.rootProject, previous?.rootProject);
	prepareProjectSources(rootProject, rootProject.blocks, directives);
	for (const level of walkProjectLevels(rootProject)) {
		for (const block of level.blocks) {
			block.x = block.gridX * viewport.vGrid;
			block.y = block.gridY * viewport.hGrid;
		}
	}
	const nextCodeBlockCreationIndex = Math.max(
		snapshot.nextCodeBlockCreationIndex,
		previous?.nextCodeBlockCreationIndex ?? 0
	);
	return { rootProject, currentProject: currentProject ?? rootProject, nextCodeBlockCreationIndex };
}
