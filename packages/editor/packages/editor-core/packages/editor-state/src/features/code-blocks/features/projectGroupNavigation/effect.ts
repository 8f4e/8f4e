import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath, type ProjectGroupPath, ROOT_PROJECT_GROUP_PATH } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import { stopViewportAnimation } from '../../../viewport/animateViewport';
import centerViewportOnCodeBlock from '../../../viewport/centerViewportOnCodeBlock';
import updateViewport from '../../../viewport/updateViewport';

export interface OpenProjectGroupEvent {
	codeBlock: CodeBlockGraphicData;
}

export function findParentProjectSlice(
	rootCodeBlocks: CodeBlockGraphicData[],
	currentCodeBlocks: CodeBlockGraphicData[]
): CodeBlockGraphicData[] | undefined {
	for (const codeBlock of rootCodeBlocks) {
		const nestedProjectCodeBlocks = codeBlock.nestedProjectCodeBlocks;
		if (nestedProjectCodeBlocks === undefined) {
			continue;
		}

		if (nestedProjectCodeBlocks === currentCodeBlocks) {
			return rootCodeBlocks;
		}

		const parentCodeBlocks = findParentProjectSlice(nestedProjectCodeBlocks, currentCodeBlocks);
		if (parentCodeBlocks) {
			return parentCodeBlocks;
		}
	}
}

/** Returns the canonical path owned by a slice in the recursive editor project tree. */
export function findProjectSlicePath(
	rootCodeBlocks: CodeBlockGraphicData[],
	targetCodeBlocks: CodeBlockGraphicData[],
	projectPath: ProjectGroupPath = ROOT_PROJECT_GROUP_PATH
): ProjectGroupPath | undefined {
	if (rootCodeBlocks === targetCodeBlocks) {
		return projectPath;
	}

	for (const codeBlock of rootCodeBlocks) {
		const nestedProjectCodeBlocks = codeBlock.nestedProjectCodeBlocks;
		if (nestedProjectCodeBlocks === undefined) {
			continue;
		}

		const nestedPath = createChildProjectGroupPath(projectPath, codeBlock.name);
		const match = findProjectSlicePath(nestedProjectCodeBlocks, targetCodeBlocks, nestedPath);
		if (match !== undefined) {
			return match;
		}
	}
}

/** Moves the editor's rendered-slice pointer through the recursive project tree. */
export default function projectGroupNavigation(store: StateManager<State>, events: EventDispatcher): void {
	const state = store.getState();
	const viewportPositions = new Map<ProjectGroupPath, { x: number; y: number }>();

	function showProjectSlice(codeBlocks: CodeBlockGraphicData[]): void {
		if (codeBlocks === state.codeBlockRendering.codeBlocks) {
			return;
		}

		const rootCodeBlocks = state.codeBlockRendering.rootCodeBlocks;
		const currentPath = findProjectSlicePath(rootCodeBlocks, state.codeBlockRendering.codeBlocks);
		if (currentPath !== undefined) {
			viewportPositions.set(currentPath, { x: state.viewport.x, y: state.viewport.y });
		}
		const targetPath = findProjectSlicePath(rootCodeBlocks, codeBlocks);
		const savedPosition = targetPath === undefined ? undefined : viewportPositions.get(targetPath);

		stopViewportAnimation(state);
		store.set('codeBlockRendering.selectedCodeBlock', undefined);
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', undefined);
		state.codeBlockRendering.draggedCodeBlock = undefined;
		store.set('codeBlockRendering.codeBlocks', codeBlocks);

		if (savedPosition) {
			updateViewport(state, savedPosition.x, savedPosition.y, events);
			return;
		}

		const homeBlock = codeBlocks.find(block => block.isHome);
		if (homeBlock) {
			const { x, y } = centerViewportOnCodeBlock(state.viewport, homeBlock, {
				alignment: homeBlock.homeAlignment,
			});
			updateViewport(state, x, y, events);
			return;
		}

		updateViewport(state, 0, 0, events);
	}

	function onOpenProjectGroup({ codeBlock }: OpenProjectGroupEvent): void {
		if (codeBlock.nestedProjectCodeBlocks !== undefined) {
			showProjectSlice(codeBlock.nestedProjectCodeBlocks);
		}
	}

	function onGoToParentProjectGroup(): void {
		const parentCodeBlocks = findParentProjectSlice(
			state.codeBlockRendering.rootCodeBlocks,
			state.codeBlockRendering.codeBlocks
		);
		if (parentCodeBlocks) {
			showProjectSlice(parentCodeBlocks);
		}
	}

	events.on<OpenProjectGroupEvent>('openProjectGroup', onOpenProjectGroup);
	events.on('goToParentProjectGroup', onGoToParentProjectGroup);
	events.on('goToRootProjectGroup', () => showProjectSlice(state.codeBlockRendering.rootCodeBlocks));
	store.subscribe('projectChange', () => {
		if (state.projectChange.kind === 'replace') viewportPositions.clear();
	});
}
