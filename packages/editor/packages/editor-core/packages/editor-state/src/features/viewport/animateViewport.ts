import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import updateViewport from './updateViewport';

const VIEWPORT_ANIMATION_DURATION_MS = 500;

function easeInOutCubic(progress: number): number {
	return progress < 0.5 ? 4 * progress * progress * progress : 1 - (-2 * progress + 2) ** 3 / 2;
}

export function stopViewportAnimation(state: State): void {
	state.viewportAnimation.active = false;
	state.viewportAnimation.startTime = undefined;
}

export default function animateViewport(state: State, x: number, y: number): void {
	state.viewportAnimation.startX = state.viewport.x;
	state.viewportAnimation.startY = state.viewport.y;
	state.viewportAnimation.targetX = x;
	state.viewportAnimation.targetY = y;
	state.viewportAnimation.startTime = undefined;

	if (state.viewport.x === x && state.viewport.y === y) {
		stopViewportAnimation(state);
		return;
	}

	state.viewportAnimation.active = true;
}

/** Advance the shared viewport before the renderer checks visibility and draws a frame. */
export function advanceViewportAnimation(state: State, frameTime: number, events: EventDispatcher): void {
	if (!state.viewportAnimation.active) {
		return;
	}

	const startTime = state.viewportAnimation.startTime ?? frameTime;
	state.viewportAnimation.startTime = startTime;

	const progress = Math.min(Math.max((frameTime - startTime) / VIEWPORT_ANIMATION_DURATION_MS, 0), 1);
	const easedProgress = easeInOutCubic(progress);
	const nextX =
		state.viewportAnimation.startX + (state.viewportAnimation.targetX - state.viewportAnimation.startX) * easedProgress;
	const nextY =
		state.viewportAnimation.startY + (state.viewportAnimation.targetY - state.viewportAnimation.startY) * easedProgress;

	const shouldSnap = progress >= 1;

	updateViewport(
		state,
		shouldSnap ? state.viewportAnimation.targetX : nextX,
		shouldSnap ? state.viewportAnimation.targetY : nextY,
		events
	);

	if (shouldSnap) {
		stopViewportAnimation(state);
	}
}
