import type { EditorCodeBlock, EventDispatcher, ProjectLevel, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { placeCurrentProjectViewport, rememberCurrentProjectView } from '../viewport/updateViewport';
import { findParentProjectLevel } from './tree';

export interface OpenProjectGroupEvent {
	codeBlock: EditorCodeBlock;
}

/** Switch the visible project level without changing source, history, or persisted state. */
export default function registerGroupNavigation(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();

	function showProject(project: ProjectLevel): void {
		const current = state.project.activeLevel;
		if (project === current) return;
		rememberCurrentProjectView(state);
		store.set('project.selectedCodeBlock', undefined);
		store.set('project.activeLevel', project);
		if (project.selectedBlock && !project.blocks.includes(project.selectedBlock)) project.selectedBlock = undefined;
		store.set('project.selectedCodeBlock', project.selectedBlock);
		placeCurrentProjectViewport(state, events);
	}

	function onOpenProjectGroup({ codeBlock }: OpenProjectGroupEvent): void {
		if (codeBlock.childProject) showProject(codeBlock.childProject);
	}

	function onGoToParentProjectGroup(): void {
		const { rootLevel, activeLevel } = state.project;
		const parent = findParentProjectLevel(rootLevel, activeLevel);
		if (parent) showProject(parent);
	}

	const onGoToRoot = () => showProject(state.project.rootLevel);
	events.on('openProjectGroup', onOpenProjectGroup);
	events.on('goToParentProjectGroup', onGoToParentProjectGroup);
	events.on('goToRootProjectGroup', onGoToRoot);
	return () => {
		events.off('openProjectGroup', onOpenProjectGroup);
		events.off('goToParentProjectGroup', onGoToParentProjectGroup);
		events.off('goToRootProjectGroup', onGoToRoot);
	};
}
