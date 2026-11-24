import type { EditorCodeBlock, ProjectLevel } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath, type ProjectGroupPath } from '@8f4e/language-spec';

export function* walkProjectLevels(project: ProjectLevel): Generator<ProjectLevel> {
	yield project;
	for (const block of project.blocks) {
		if (block.childProject) yield* walkProjectLevels(block.childProject);
	}
}

/** Find the level containing the block that owns this project, independent of source paths. */
export function findParentProjectLevel(root: ProjectLevel, project: ProjectLevel): ProjectLevel | undefined {
	if (project === root) return;
	for (const level of walkProjectLevels(root)) {
		if (level.blocks.some(block => block.childProject === project)) return level;
	}
}

export function* walkProjectBlocks(project: ProjectLevel): Generator<EditorCodeBlock> {
	for (const level of walkProjectLevels(project)) yield* level.blocks;
}

/** Refresh ownership paths after renaming a project group. */
export function updateProjectLevelPath(project: ProjectLevel, path: ProjectGroupPath): void {
	project.path = path;
	for (const block of project.blocks) {
		block.projectPath = path;
		if (block.childProject) {
			updateProjectLevelPath(block.childProject, createChildProjectGroupPath(path, block.name));
		}
	}
}
