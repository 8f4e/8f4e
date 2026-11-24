import type { CodeBlockGraphicData, EventDispatcher, ProjectLevel, State } from '@8f4e/editor-state-types';
import type { ProjectMembership } from '../projectMembership';
import { calculateBlockLayout } from './calculateBlockLayout';
import type { LayoutRegistry } from './registry';

/** Settle contributions and final geometry before publishing completed layouts. */
export function createLayoutCoordinator(
	state: State,
	events: EventDispatcher,
	layout: LayoutRegistry,
	membership: Pick<ProjectMembership, 'getOwner'>
) {
	const pending = new Map<ProjectLevel, Set<CodeBlockGraphicData>>();
	let calculating = false;
	let batching = 0;

	const flush = (): void => {
		if (calculating || batching || state.viewport.vGrid <= 0 || state.viewport.hGrid <= 0) return;
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
				if (membership.getOwner(block) !== project) continue;
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
			const project = membership.getOwner(block);
			if (project) getPendingBlocks(project).add(block);
		}
		flush();
	};

	const refreshProject = (project: ProjectLevel): void => {
		const queued = getPendingBlocks(project);
		for (const block of project.blocks) queued.add(block);
		flush();
	};

	/** Queue geometry invalidations until the source mutation and its synchronous derivation finish. */
	const batch = <T>(work: () => T): T => {
		batching++;
		let result: T;
		try {
			result = work();
		} finally {
			batching--;
		}
		flush();
		return result;
	};

	return {
		batch,
		clearPending: () => pending.clear(),
		refreshBlocks,
		refreshProject,
	};
}

export type LayoutCoordinator = ReturnType<typeof createLayoutCoordinator>;
