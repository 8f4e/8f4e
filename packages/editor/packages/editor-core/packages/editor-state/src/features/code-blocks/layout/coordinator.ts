import type { CodeBlockGraphicData, EventDispatcher, ProjectLevel, State } from '@8f4e/editor-state-types';
import { calculateBlockLayout } from './calculateBlockLayout';
import type { LayoutRegistry } from './registry';

/** Own group membership, contribution settling, and final geometry before publishing completed layouts. */
export function createLayoutCoordinator(state: State, events: EventDispatcher, layout: LayoutRegistry) {
	let owners = new WeakMap<CodeBlockGraphicData, ProjectLevel>();
	// Ownership snapshots, refreshed only when a project's block collection changes.
	let projects = new WeakMap<ProjectLevel, ReadonlySet<CodeBlockGraphicData>>();
	const pending = new Map<ProjectLevel, Set<CodeBlockGraphicData>>();
	let calculating = false;

	const unregisterProject = (project: ProjectLevel): void => {
		for (const block of projects.get(project) ?? []) {
			owners.delete(block);
			if (block.childProject) unregisterProject(block.childProject);
		}
		projects.delete(project);
	};

	const syncProject = (project: ProjectLevel): CodeBlockGraphicData[] => {
		const registered = projects.get(project);
		if (registered?.size === project.blocks.length && project.blocks.every(block => registered.has(block))) return [];
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
		pending.clear();
		syncProject(root);
	};

	const flush = (): void => {
		if (calculating || state.viewport.vGrid <= 0 || state.viewport.hGrid <= 0) return;
		calculating = true;
		const completed = new Map<ProjectLevel, Set<CodeBlockGraphicData>>();
		try {
			while (pending.size) {
				const [project, blocks] = pending.entries().next().value!;
				if (!completed.has(project)) completed.set(project, new Set());
				const block = blocks.values().next().value;
				if (!block) {
					pending.delete(project);
					continue;
				}
				blocks.delete(block);
				if (owners.get(block) !== project) continue;
				calculateBlockLayout(block, state, layout.getContribution(block));
				layout.publish({ codeBlock: block, state });
				completed.get(project)!.add(block);
			}
		} finally {
			calculating = false;
		}
		for (const [project, blocks] of completed) {
			events.dispatch('codeBlockLayoutsChanged', { project, codeBlocks: [...blocks] });
		}
	};

	const getPendingBlocks = (project: ProjectLevel): Set<CodeBlockGraphicData> => {
		let queued = pending.get(project);
		if (!queued) {
			queued = new Set();
			pending.set(project, queued);
		}
		return queued;
	};

	const refreshBlocks = (blocks: readonly CodeBlockGraphicData[]): void => {
		for (const block of blocks) {
			const project = owners.get(block);
			if (project) getPendingBlocks(project).add(block);
		}
		flush();
	};

	const refreshProject = (project: ProjectLevel): void => {
		const queued = getPendingBlocks(project);
		for (const block of project.blocks) queued.add(block);
		flush();
	};

	reset(state.codeBlockRendering.rootProject);

	return {
		reset,
		syncProject,
		refreshBlocks,
		refreshProject,
	};
}
