import type { EditorCodeBlock, ProjectLevel } from '@8f4e/editor-state-types';
import { walkProjectLevels } from './tree';

/** Track attached blocks by object identity, independently of draw order and project paths. */
export function createProjectMembership(root: ProjectLevel) {
	let owners = new WeakMap<EditorCodeBlock, ProjectLevel>();
	let projects = new WeakSet<ProjectLevel>();

	/** Rebuild ownership once after project structure changes. */
	const reset = (root: ProjectLevel): void => {
		owners = new WeakMap();
		projects = new WeakSet();
		for (const project of walkProjectLevels(root)) {
			projects.add(project);
			for (const block of project.blocks) owners.set(block, project);
		}
	};

	reset(root);

	return {
		reset,
		getOwner: (block: EditorCodeBlock) => owners.get(block),
		hasProject: (project: ProjectLevel) => projects.has(project),
	};
}

export type ProjectMembership = ReturnType<typeof createProjectMembership>;
