import type { EditorLifecycleEvents, EventDispatcher, ProjectLevel, State } from '@8f4e/editor-state-types';
import getProjectViewportPosition from './getProjectViewportPosition';

/** A first visit awaiting settled geometry, scoped to its editor state and project level. */
const pendingProjectViewport = new WeakMap<State, ProjectLevel>();

/** Discard an unplaced project when navigation or replacement supersedes it. */
export function cancelPendingProjectViewport(state: State): void {
	pendingProjectViewport.delete(state);
}

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
	if (source !== undefined) cancelPendingProjectViewport(state);
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
	const { activeLevel, selectedCodeBlock } = state.project;
	if (pendingProjectViewport.get(state) !== activeLevel) {
		activeLevel.viewport = { x: state.viewport.x, y: state.viewport.y };
	}
	activeLevel.selectedBlock = selectedCodeBlock;
}

/** Once source has settled, restore memory immediately or defer first-visit placement until the grid is ready. */
export function placeCurrentProjectViewport(state: State, events: EventDispatcher): void {
	const project = state.project.activeLevel;
	cancelPendingProjectViewport(state);
	if (!project.viewport && !state.gridSizeReady) {
		pendingProjectViewport.set(state, project);
		updateViewport(state, 0, 0, events);
		return;
	}
	const { x, y } = getProjectViewportPosition(project, events);
	updateViewport(state, x, y, events);
}

/** Finish a pending first visit after the grid handoff settles layout. */
export function resolvePendingProjectViewport(state: State, events: EventDispatcher): void {
	if (!state.gridSizeReady) return;
	const pending = pendingProjectViewport.get(state);
	if (pending && pending === state.project.activeLevel) placeCurrentProjectViewport(state, events);
	else cancelPendingProjectViewport(state);
}
