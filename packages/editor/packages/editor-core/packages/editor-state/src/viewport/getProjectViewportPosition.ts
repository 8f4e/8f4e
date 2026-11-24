import type { EventDispatcher, Position, ProjectLevel } from '@8f4e/editor-state-types';

/** Remembered browser-memory positions take precedence over contributed first-visit placement. */
export default function getProjectViewportPosition(level: ProjectLevel, events: EventDispatcher): Position {
	if (level.viewport) return level.viewport;
	const request = { level, position: { x: 0, y: 0 } };
	events.dispatch('resolveInitialProjectViewport', request);
	return request.position;
}
