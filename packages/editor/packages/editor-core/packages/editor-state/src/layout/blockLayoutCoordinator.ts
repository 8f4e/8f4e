import type { EditorCodeBlock, EventDispatcher, ProjectLevel, State } from '@8f4e/editor-state-types';
import type { ProjectMembership } from '../project/membership';
import { calculateBlockLayout } from './calculateBlockLayout';
import type { LayoutRegistry } from './layoutContributionRegistry';

/** Settle contributions and final geometry before publishing completed layouts. */
export function createLayoutCoordinator(
	state: State,
	events: EventDispatcher,
	layout: LayoutRegistry,
	membership: Pick<ProjectMembership, 'getOwner'>
) {
	const pending = new Map<ProjectLevel, Set<EditorCodeBlock>>();
	let calculating = false;
	let batching = 0;

	const flush = (): void => {
		if (calculating || batching || state.viewport.vGrid <= 0 || state.viewport.hGrid <= 0) return;
		calculating = true;
		const completed = new Map<ProjectLevel, Set<EditorCodeBlock>>();
		try {
			while (pending.size) {
				const [level, blocks] = pending.entries().next().value!;
				if (!completed.has(level)) completed.set(level, new Set());
				const block = blocks.values().next().value;
				if (!block) {
					pending.delete(level);
					continue;
				}
				blocks.delete(block);
				if (membership.getOwner(block) !== level) continue;
				calculateBlockLayout(block, state, layout.getContribution(block));
				layout.publish({ codeBlock: block, state });
				completed.get(level)!.add(block);
			}
		} finally {
			calculating = false;
		}
		for (const [level, blocks] of completed) {
			events.dispatch('codeBlockLayoutsChanged', { level, codeBlocks: [...blocks] });
		}
	};

	const getPendingBlocks = (level: ProjectLevel): Set<EditorCodeBlock> => {
		let queued = pending.get(level);
		if (!queued) {
			queued = new Set();
			pending.set(level, queued);
		}
		return queued;
	};

	const refreshBlocks = (blocks: readonly EditorCodeBlock[]): void => {
		for (const block of blocks) {
			const level = membership.getOwner(block);
			if (level) getPendingBlocks(level).add(block);
		}
		flush();
	};

	const refreshProject = (level: ProjectLevel): void => {
		const queued = getPendingBlocks(level);
		for (const block of level.blocks) queued.add(block);
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
