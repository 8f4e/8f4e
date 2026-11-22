import type { EventDispatcher, Position, ProjectLevel } from '@8f4e/editor-state-types';

/** Remembered browser-memory positions take precedence over contributed first-visit placement. */
export default function getProjectViewportPosition(project: ProjectLevel, events: EventDispatcher): Position {
	if (project.viewport) return project.viewport;
	const request = { project, position: { x: 0, y: 0 } };
	events.dispatch('resolveInitialProjectViewport', request);
	return request.position;
}
