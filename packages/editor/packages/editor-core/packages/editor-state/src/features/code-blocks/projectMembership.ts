import type { CodeBlockGraphicData, ProjectLevel } from '@8f4e/editor-state-types';

/** Track attached blocks by object identity, independently of draw order and project paths. */
export function createProjectMembership(root: ProjectLevel) {
	let owners = new WeakMap<CodeBlockGraphicData, ProjectLevel>();
	let projects = new WeakMap<ProjectLevel, ReadonlySet<CodeBlockGraphicData>>();

	const unregisterProject = (project: ProjectLevel): void => {
		for (const block of projects.get(project) ?? []) {
			owners.delete(block);
			if (block.childProject) unregisterProject(block.childProject);
		}
		projects.delete(project);
	};

	/** Synchronize a changed collection without re-registering unchanged descendant projects. */
	const syncProject = (project: ProjectLevel): void => {
		const registered = projects.get(project);
		const current = new Set(project.blocks);
		for (const block of registered ?? []) {
			if (current.has(block)) continue;
			owners.delete(block);
			if (block.childProject) unregisterProject(block.childProject);
		}
		for (const block of current) {
			if (registered?.has(block)) continue;
			owners.set(block, project);
			if (block.childProject) syncProject(block.childProject);
		}
		projects.set(project, current);
	};

	const reset = (root: ProjectLevel): void => {
		owners = new WeakMap();
		projects = new WeakMap();
		syncProject(root);
	};

	reset(root);

	return {
		reset,
		syncProject,
		getOwner: (block: CodeBlockGraphicData) => owners.get(block),
		hasProject: (project: ProjectLevel) => projects.has(project),
	};
}

export type ProjectMembership = ReturnType<typeof createProjectMembership>;
