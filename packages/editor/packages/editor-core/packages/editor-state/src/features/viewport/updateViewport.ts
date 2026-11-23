import type { EditorLifecycleEvents, EventDispatcher, ProjectLevel, State } from '@8f4e/editor-state-types';
import { isRestoringProject } from '../project-changes/restoring';
import getProjectViewportPosition from './getProjectViewportPosition';

/** A first visit awaiting settled geometry, scoped to its editor state and project level. */
const pendingProjectViewport = new WeakMap<State, ProjectLevel>();

/**
 * Applies viewport position updates through a single commit path.
 */
export default function updateViewport(
	state: State,
	x: number,
	y: number,
	events: EventDispatcher,
	source?: EditorLifecycleEvents['viewportChanged']['source']
): boolean {
	// An explicit navigation takes ownership of the view even if its target is the current position.
	if (source !== undefined) pendingProjectViewport.delete(state);
	const previousX = state.viewport.x;
	const previousY = state.viewport.y;
	const nextX = Math.round(x);
	const nextY = Math.round(y);

	state.viewport.x = nextX;
	state.viewport.y = nextY;

	const changed = state.viewport.x !== previousX || state.viewport.y !== previousY;

	if (changed) {
		const event: EditorLifecycleEvents['viewportChanged'] = {
			previousX,
			previousY,
			x: state.viewport.x,
			y: state.viewport.y,
		};
		if (source !== undefined) event.source = source;
		events.dispatch('viewportChanged', event);
	}

	return changed;
}

/** Save a departing view without turning a deferred first visit's placeholder into a remembered position. */
export function rememberCurrentProjectView(state: State): void {
	const { currentProject, selectedCodeBlock } = state.codeBlockRendering;
	if (pendingProjectViewport.get(state) !== currentProject) {
		currentProject.viewport = { x: state.viewport.x, y: state.viewport.y };
	}
	currentProject.selectedBlock = selectedCodeBlock;
}

/** Restore a remembered position immediately, or resolve the first visit once source and grid are ready. */
export function placeCurrentProjectViewport(state: State, events: EventDispatcher): void {
	const project = state.codeBlockRendering.currentProject;
	pendingProjectViewport.delete(state);
	if (!project.viewport && (!state.gridSizeReady || isRestoringProject(state))) {
		pendingProjectViewport.set(state, project);
		if (!state.gridSizeReady) updateViewport(state, 0, 0, events);
		return;
	}
	const { x, y } = getProjectViewportPosition(project, events);
	updateViewport(state, x, y, events);
}

/** Called after project restoration or a grid handoff, when source and layout may have settled. */
export function resolvePendingProjectViewport(state: State, events: EventDispatcher): void {
	if (!state.gridSizeReady || isRestoringProject(state)) return;
	const pending = pendingProjectViewport.get(state);
	pendingProjectViewport.delete(state);
	if (pending && pending === state.codeBlockRendering.currentProject) placeCurrentProjectViewport(state, events);
}
