import type { CodeBlockGraphicData, EventDispatcher, ProjectLevel, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { findParentProjectLevel } from '../../../../pureHelpers/projectTree';
import { placeCurrentProjectViewport, rememberCurrentProjectView } from '../../../viewport/updateViewport';

export interface OpenProjectGroupEvent {
	codeBlock: CodeBlockGraphicData;
}

/** Switch the visible project level without changing source, history, or persisted state. */
export default function projectGroupNavigation(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();

	function showProject(project: ProjectLevel): void {
		const current = state.codeBlockRendering.currentProject;
		if (project === current) return;
		rememberCurrentProjectView(state);
		store.set('codeBlockRendering.selectedCodeBlock', undefined);
		state.codeBlockRendering.draggedCodeBlock = undefined;
		store.set('codeBlockRendering.currentProject', project);
		if (project.selectedBlock && !project.blocks.includes(project.selectedBlock)) project.selectedBlock = undefined;
		store.set('codeBlockRendering.selectedCodeBlock', project.selectedBlock);
		placeCurrentProjectViewport(state, events);
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
	events.on('openProjectGroup', onOpenProjectGroup);
	events.on('goToParentProjectGroup', onGoToParentProjectGroup);
	events.on('goToRootProjectGroup', onGoToRoot);
	return () => {
		events.off('openProjectGroup', onOpenProjectGroup);
		events.off('goToParentProjectGroup', onGoToParentProjectGroup);
		events.off('goToRootProjectGroup', onGoToRoot);
	};
}
