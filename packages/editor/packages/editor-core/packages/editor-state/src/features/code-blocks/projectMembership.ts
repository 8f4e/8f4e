import type { CodeBlockGraphicData, ProjectLevel } from '@8f4e/editor-state-types';
import { walkProjectLevels } from '../../pureHelpers/projectTree';

/** Track attached blocks by object identity, independently of draw order and project paths. */
export function createProjectMembership(root: ProjectLevel) {
	let owners = new WeakMap<CodeBlockGraphicData, ProjectLevel>();
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
		getOwner: (block: CodeBlockGraphicData) => owners.get(block),
		hasProject: (project: ProjectLevel) => projects.has(project),
	};
}

export type ProjectMembership = ReturnType<typeof createProjectMembership>;
