import type { CodeBlockGraphicData, ProjectLevel } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath, type ProjectGroupPath } from '@8f4e/language-spec';

export function* walkProjectLevels(project: ProjectLevel): Generator<ProjectLevel> {
	yield project;
	for (const block of project.blocks) {
		if (block.childProject) yield* walkProjectLevels(block.childProject);
	}
}

export function findProjectLevel(root: ProjectLevel, path: ProjectGroupPath): ProjectLevel | undefined {
	for (const level of walkProjectLevels(root)) {
		if (level.path === path) return level;
	}
}

export function findParentProjectLevel(root: ProjectLevel, project: ProjectLevel): ProjectLevel | undefined {
	if (project === root) return;
	return findProjectLevel(root, project.path.slice(0, Math.max(0, project.path.lastIndexOf('/'))));
}

export function* walkProjectBlocks(project: ProjectLevel): Generator<CodeBlockGraphicData> {
	for (const level of walkProjectLevels(project)) yield* level.blocks;
}

/** Detached source-edit draft; runtime viewport positions stay on the live project tree. */
export function copyProjectLevel(project: ProjectLevel): ProjectLevel {
	return {
		path: project.path,
		entries: [...project.entries],
		blocks: project.blocks.map(block => ({
			...block,
			code: [...block.code],
			...(block.childProject ? { childProject: copyProjectLevel(block.childProject) } : {}),
		})),
	};
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
