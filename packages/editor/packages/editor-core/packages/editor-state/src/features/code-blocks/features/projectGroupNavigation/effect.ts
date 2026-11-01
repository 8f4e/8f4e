import type { CodeBlockGraphicData, EventDispatcher, ProjectLevel, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { findParentProjectLevel } from '../../../../pureHelpers/projectTree';
import { stopViewportAnimation } from '../../../viewport/animateViewport';
import getProjectViewportPosition from '../../../viewport/getProjectViewportPosition';
import updateViewport from '../../../viewport/updateViewport';

export interface OpenProjectGroupEvent {
	codeBlock: CodeBlockGraphicData;
}

/** Switch the visible project level without changing source, history, or persisted state. */
export default function projectGroupNavigation(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();

	function showProject(project: ProjectLevel): void {
		const current = state.codeBlockRendering.currentProject;
		if (project === current) return;
		current.viewport = { x: state.viewport.x, y: state.viewport.y };
		stopViewportAnimation(state);
		store.set('codeBlockRendering.selectedCodeBlock', undefined);
		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', undefined);
		state.codeBlockRendering.draggedCodeBlock = undefined;
		store.set('codeBlockRendering.currentProject', project);
		const { x, y } = getProjectViewportPosition(project, state.viewport);
		updateViewport(state, x, y, events);
	}

	function onOpenProjectGroup({ codeBlock }: OpenProjectGroupEvent): void {
		if (codeBlock.childProject) showProject(codeBlock.childProject);
	}

	function onGoToParentProjectGroup(): void {
		const { rootProject, currentProject } = state.codeBlockRendering;
		const parent = findParentProjectLevel(rootProject, currentProject);
		if (parent) showProject(parent);
	}

	const onGoToRoot = () => showProject(state.codeBlockRendering.rootProject);
	events.on<OpenProjectGroupEvent>('openProjectGroup', onOpenProjectGroup);
	events.on('goToParentProjectGroup', onGoToParentProjectGroup);
	events.on('goToRootProjectGroup', onGoToRoot);
	return () => {
		events.off('openProjectGroup', onOpenProjectGroup);
		events.off('goToParentProjectGroup', onGoToParentProjectGroup);
		events.off('goToRootProjectGroup', onGoToRoot);
	};
}
