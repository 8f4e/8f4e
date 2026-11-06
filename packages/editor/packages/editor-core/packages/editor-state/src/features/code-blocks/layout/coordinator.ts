import type {
	CodeBlockGraphicData,
	EditorDirectiveDefinition,
	EventDispatcher,
	ProjectLevel,
	State,
} from '@8f4e/editor-state-types';
import gapCalculator from '../../text-geometry/gapCalculator';
import { deriveDirectiveState } from '../features/directives/registry';
import { resolveViewportAnchoredPosition } from '../features/directives/viewport/resolve';
import gaps from '../gaps';
import getCodeBlockGridWidth from '../getCodeBlockGridWidth';
import { partitionCodeBlocksByAlwaysOnTop } from '../partitionCodeBlocksByAlwaysOnTop';
import replaceCodeBlocksInPlace from '../replaceCodeBlocksInPlace';
import type { LayoutRegistry } from './registry';
import type { BlockLayoutDraft } from './types';

interface ProjectLayout {
	/** Ownership snapshot, refreshed only when the project's block collection changes. */
	blocks: readonly CodeBlockGraphicData[];
	anchoredBlocks: Set<CodeBlockGraphicData>;
}

/** Own group membership, contribution settling, and final geometry before publishing completed layouts. */
export function createLayoutCoordinator(
	state: State,
	events: EventDispatcher,
	directives: EditorDirectiveDefinition[],
	layout: LayoutRegistry
) {
	let owners = new WeakMap<CodeBlockGraphicData, ProjectLevel>();
	let projects = new WeakMap<ProjectLevel, ProjectLayout>();
	const pending = new Map<ProjectLevel, Set<CodeBlockGraphicData>>();
	let calculating = false;

	const unregisterProject = (project: ProjectLevel): void => {
		for (const block of projects.get(project)?.blocks ?? []) {
			owners.delete(block);
			if (block.childProject) unregisterProject(block.childProject);
		}
		projects.delete(project);
	};

	const syncProject = (project: ProjectLevel): void => {
		const registered = projects.get(project);
		if (
			registered?.blocks.length === project.blocks.length &&
			registered.blocks.every((block, index) => block === project.blocks[index])
		)
			return;
		unregisterProject(project);
		const anchoredBlocks = new Set<CodeBlockGraphicData>();
		projects.set(project, { blocks: [...project.blocks], anchoredBlocks });
		for (const block of project.blocks) {
			owners.set(block, project);
			if (block.viewportAnchor) anchoredBlocks.add(block);
			if (block.childProject) syncProject(block.childProject);
		}
	};

	const reset = (root: ProjectLevel): void => {
		owners = new WeakMap();
		projects = new WeakMap();
		pending.clear();
		syncProject(root);
	};

	const positionBlock = (project: ProjectLevel, block: CodeBlockGraphicData): void => {
		if (!block.viewportAnchor) {
			block.x = block.gridX * state.viewport.vGrid;
			block.y = block.gridY * state.viewport.hGrid;
			return;
		}
		if (block === state.codeBlockRendering.draggedCodeBlock) return;
		const viewport = project === state.codeBlockRendering.currentProject ? state.viewport : project.viewport;
		const position = resolveViewportAnchoredPosition({
			anchor: block.viewportAnchor,
			posX: block.gridX,
			posY: block.gridY,
			viewportX: viewport?.x ?? 0,
			viewportY: viewport?.y ?? 0,
			viewportWidth: state.viewport.roundedWidth,
			viewportHeight: state.viewport.roundedHeight,
			blockWidth: block.width,
			blockHeight: block.height,
			vGrid: state.viewport.vGrid,
			hGrid: state.viewport.hGrid,
		});
		block.x = position.x;
		block.y = position.y;
	};

	const calculateBlock = (project: ProjectLevel, block: CodeBlockGraphicData): boolean => {
		const directiveState = deriveDirectiveState(
			block.code,
			block.parsedDirectives,
			{ isExpandedForEditing: block === state.codeBlockRendering.selectedCodeBlock },
			directives
		);
		const displayModel = directiveState.displayModel;
		block.displayModel = displayModel;
		block.disabled = directiveState.blockState.disabled;
		block.isHome = directiveState.blockState.isHome;
		block.homeAlignment = directiveState.blockState.homeAlignment;
		block.lineNumberColumnWidth = block.code.length.toString().length;
		block.isCollapsed = displayModel.isCollapsed;
		const contribution = layout.getContribution(block);
		const draft: BlockLayoutDraft = {
			displayModel,
			verticalSpaceAfterSourceLine: [...contribution.verticalSpaceAfterSourceLine],
		};
		block.minGridWidth = contribution.minGridWidth;
		gaps(block, draft);
		block.width = getCodeBlockGridWidth(block.code, block.minGridWidth) * state.viewport.vGrid;
		const gapRows = [...block.gaps.values()].reduce((total, gap) => total + gap.size, 0);
		block.height = (displayModel.lines.length + gapRows) * state.viewport.hGrid;
		const displayRow = displayModel.sourceLineIndexToDisplayRow[block.cursor.row] ?? block.cursor.row;
		block.cursor.y = gapCalculator(displayRow, block.gaps) * state.viewport.hGrid;
		const previousAlwaysOnTop = Boolean(block.alwaysOnTop);
		block.viewportAnchor = directiveState.blockState.viewportAnchor;
		block.alwaysOnTop = directiveState.blockState.alwaysOnTop ?? false;
		const anchoredBlocks = projects.get(project)!.anchoredBlocks;
		if (block.viewportAnchor) anchoredBlocks.add(block);
		else anchoredBlocks.delete(block);
		positionBlock(project, block);
		return block.alwaysOnTop !== previousAlwaysOnTop;
	};

	const flush = (): void => {
		if (calculating) return;
		calculating = true;
		const completed = new Map<ProjectLevel, Set<CodeBlockGraphicData>>();
		const reordered = new Set<ProjectLevel>();
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
				if (calculateBlock(project, block)) reordered.add(project);
				layout.publish({ codeBlock: block, state });
				completed.get(project)!.add(block);
			}
		} finally {
			calculating = false;
		}
		for (const project of reordered) {
			replaceCodeBlocksInPlace(project.blocks, partitionCodeBlocksByAlwaysOnTop(project.blocks));
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

	const positionAnchoredBlocks = (): void => {
		const project = state.codeBlockRendering.currentProject;
		for (const block of projects.get(project)?.anchoredBlocks ?? []) positionBlock(project, block);
	};
	events.on('viewportChanged', positionAnchoredBlocks);
	events.on('viewportResized', positionAnchoredBlocks);
	reset(state.codeBlockRendering.rootProject);

	return {
		reset,
		syncProject,
		refreshBlocks,
		refreshProject,
		dispose: () => {
			events.off('viewportChanged', positionAnchoredBlocks);
			events.off('viewportResized', positionAnchoredBlocks);
		},
	};
}
