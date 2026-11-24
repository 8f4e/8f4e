import type {
	EditorCodeBlock,
	EditorDirectiveDefinition,
	EditorLevelSnapshot,
	EditorProjectSnapshot,
	EditorProjectState,
	ProjectLevel,
	Viewport,
} from '@8f4e/editor-state-types';
import { createEditorCodeBlock } from './blocks/createEditorCodeBlock';
import getCodeBlockNameFromSource from './blocks/getCodeBlockNameFromSource';
import { prepareProjectSourceMetadata } from './blocks/refreshSourceMetadata';
import { walkProjectLevels } from './tree';

/** Rebuild editor source and reconcile remembered views without taking source facts from the outgoing view. */
export function reconstructProject(
	snapshot: EditorProjectSnapshot,
	directives: EditorDirectiveDefinition[],
	viewport: Pick<Viewport, 'vGrid' | 'hGrid'>,
	previous?: EditorProjectState
) {
	let activeLevel: ProjectLevel | undefined;
	const createProjectLevel = (level: EditorLevelSnapshot, previousLevel?: ProjectLevel): ProjectLevel => {
		// IDs are stable within a project's own block collection. Follow owning
		// blocks rather than names, which may change or be duplicated while editing.
		const previousBlocks = new Map(previousLevel?.blocks.map(block => [block.creationIndex, block]));
		let selectedBlock: EditorCodeBlock | undefined;
		const blocks = level.blocks.map(block => {
			const previousBlock = previousBlocks.get(block.creationIndex);
			const code = [...block.code];
			const editorBlock = createEditorCodeBlock({
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
			if (previousBlock && previousBlock === previousLevel?.selectedBlock) selectedBlock = editorBlock;
			return editorBlock;
		});
		const project: ProjectLevel = {
			path: level.path,
			entries: [...level.entries],
			blocks,
			viewport: previousLevel?.viewport,
			selectedBlock,
		};
		if (previousLevel && previousLevel === previous?.activeLevel) activeLevel = project;
		return project;
	};
	const rootLevel = createProjectLevel(snapshot.rootLevel, previous?.rootLevel);
	prepareProjectSourceMetadata(rootLevel, rootLevel.blocks, directives);
	for (const level of walkProjectLevels(rootLevel)) {
		for (const block of level.blocks) {
			block.x = block.gridX * viewport.vGrid;
			block.y = block.gridY * viewport.hGrid;
		}
	}
	const nextCodeBlockCreationIndex = Math.max(
		snapshot.nextCodeBlockCreationIndex,
		previous?.nextCodeBlockCreationIndex ?? 0
	);
	return { rootLevel, activeLevel: activeLevel ?? rootLevel, nextCodeBlockCreationIndex };
}
