import type { EditorLifecycleEvents } from '@8f4e/editor-state-types';

type ViewportOrigin = Readonly<{ x: number; y: number }>;
type ViewportChange = Pick<EditorLifecycleEvents['viewportChanged'], 'x' | 'y' | 'source'>;

interface Transition {
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	durationMs: number;
	startedAt?: number;
	elapsedMs: number;
}

interface ViewportTransitionFrame {
	x: number;
	y: number;
	suppressBlockOffsets: boolean;
}

const NAVIGATION_SPEED_PIXELS_PER_MS = 2.5;

/** Own the visual camera between logical viewport commits. Sample only when drawing a frame. */
export function createViewportTransition(initialOrigin: ViewportOrigin) {
	const frame: ViewportTransitionFrame = {
		x: initialOrigin.x,
		y: initialOrigin.y,
		suppressBlockOffsets: false,
	};
	let transition: Transition | undefined;
	let pendingNonPanChange = false;

	return {
		onViewportChanged({ x, y, source }: ViewportChange): void {
			// If several commits arrive before the next frame, none of their non-pan displacement should spring.
			pendingNonPanChange ||= source !== 'pan';
			transition = undefined;
			if (source !== 'navigation' || (x === frame.x && y === frame.y)) return;
			transition = {
				fromX: frame.x,
				fromY: frame.y,
				toX: x,
				toY: y,
				durationMs: Math.hypot(x - frame.x, y - frame.y) / NAVIGATION_SPEED_PIXELS_PER_MS,
				elapsedMs: 0,
			};
		},
		/** Whether a navigation glide is pending its first sample or still in progress. */
		isTransitioning(): boolean {
			return transition !== undefined;
		},
		reset(): void {
			transition = undefined;
			pendingNonPanChange = true;
		},
		/** Return a frame-scoped, whole-pixel origin. Storage is overwritten on the next sample. */
		sample(
			logical: ViewportOrigin,
			frameTime: number,
			prefersReducedMotion: boolean
		): Readonly<ViewportTransitionFrame> {
			frame.suppressBlockOffsets = pendingNonPanChange || transition !== undefined;
			pendingNonPanChange = false;
			if (transition && (prefersReducedMotion || logical.x !== transition.toX || logical.y !== transition.toY)) {
				transition = undefined;
			}
			if (transition) {
				transition.startedAt ??= frameTime;
				// An on-demand render can have a timestamp slightly ahead of the next scheduled frame.
				transition.elapsedMs = Math.max(transition.elapsedMs, frameTime - transition.startedAt);
				if (transition.elapsedMs >= transition.durationMs) {
					transition = undefined;
				} else {
					const progress = transition.elapsedMs / transition.durationMs;
					frame.x = Math.round(transition.fromX + (transition.toX - transition.fromX) * progress) || 0;
					frame.y = Math.round(transition.fromY + (transition.toY - transition.fromY) * progress) || 0;
				}
			}
			if (!transition) {
				frame.x = logical.x;
				frame.y = logical.y;
			}
			return frame;
		},
	};
}
