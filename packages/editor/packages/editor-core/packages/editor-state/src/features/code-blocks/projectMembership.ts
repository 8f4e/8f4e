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

	/** Return newly attached blocks, or undefined if membership is unchanged (including reordering). */
	const syncProject = (project: ProjectLevel): CodeBlockGraphicData[] | undefined => {
		const registered = projects.get(project);
		if (registered?.size === project.blocks.length && project.blocks.every(block => registered.has(block))) return;
		const added = project.blocks.filter(block => !registered?.has(block));
		unregisterProject(project);
		projects.set(project, new Set(project.blocks));
		for (const block of project.blocks) {
			owners.set(block, project);
			if (block.childProject) syncProject(block.childProject);
		}
		return added;
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
