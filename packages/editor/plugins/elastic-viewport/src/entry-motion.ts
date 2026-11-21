import type { ResolvedElasticViewportOptions } from './options';
import { advanceViewportSpring, createViewportSpring, type ViewportSpring } from './spring';

type Bounds = Readonly<{ x: number; y: number; width: number; height: number }>;
type Edge = 'left' | 'right' | 'top' | 'bottom';

interface Entry {
	edge: Edge;
	frame: number;
	lastDepth: number;
	lastPullTime: number;
	spring?: ViewportSpring;
}

/** Frame-scoped entry holds and releases, composed on top of the ordinary block offset. */
export function createEntryMotion(
	{ releaseDistancePixels, idleReleaseMs, frequency }: ResolvedElasticViewportOptions['entry'],
	springOptions: ResolvedElasticViewportOptions['spring']
) {
	let entries: WeakMap<Bounds, Entry> | undefined;
	let frame = 0;
	let active = false;
	let previousX = 0;
	let previousY = 0;
	let viewX = 0;
	let viewY = 0;
	let viewWidth = 0;
	let viewHeight = 0;
	let frameTime = 0;
	let elapsedSeconds = 0;
	let detectEntrances = false;

	const resolve = (block: Bounds, offset: { x: number; y: number }) => {
		if (!entries && !detectEntrances) return;
		let entry = entries?.get(block);
		if (entry && entry.frame !== frame - 1) {
			// The block wasn't projected last frame, so any old hold or release is no longer relevant.
			entries?.delete(block);
			entry = undefined;
		}
		if (!entry && !detectEntrances) return;

		const x = block.x - viewX;
		const y = block.y - viewY;
		const right = x + block.width;
		const bottom = y + block.height;
		if (x >= viewWidth || y >= viewHeight || right <= 0 || bottom <= 0) {
			if (entry) entries?.delete(block);
			return;
		}

		const dx = viewX - previousX;
		const dy = viewY - previousY;
		const oldX = x + dx;
		const oldY = y + dy;
		const xEdge = oldX + block.width <= 0 ? 'left' : oldX >= viewWidth ? 'right' : undefined;
		const yEdge = oldY + block.height <= 0 ? 'top' : oldY >= viewHeight ? 'bottom' : undefined;
		let edge = entry?.edge;
		if (!edge) {
			if (xEdge && yEdge) {
				// At a corner, use whichever edge was crossed last along this pan step.
				const xDepth = xEdge === 'left' ? right : viewWidth - x;
				const yDepth = yEdge === 'top' ? bottom : viewHeight - y;
				edge = xDepth / Math.abs(dx) <= yDepth / Math.abs(dy) ? xEdge : yEdge;
			} else {
				edge = xEdge ?? yEdge;
			}
		}
		if (!edge) return;

		const horizontal = edge === 'left' || edge === 'right';
		const inward = edge === 'left' || edge === 'top' ? 1 : -1;
		const depth = edge === 'left' ? right : edge === 'right' ? viewWidth - x : edge === 'top' ? bottom : viewHeight - y;
		const presentedDepth = depth + inward * (horizontal ? offset.x : offset.y);
		if (!entry) {
			entries ??= new WeakMap();
			entry = { edge, frame, lastDepth: depth, lastPullTime: frameTime };
			entries.set(block, entry);
		}
		entry.frame = frame;

		let spring = entry.spring;
		if (spring) {
			if (!advanceViewportSpring(spring, elapsedSeconds, 0, 0)) {
				entries?.delete(block);
				return;
			}
		} else {
			if (detectEntrances && depth > entry.lastDepth) entry.lastPullTime = frameTime;
			entry.lastDepth = depth;
			const idle = frameTime - entry.lastPullTime >= idleReleaseMs;
			if (!idle && presentedDepth < releaseDistancePixels) {
				// The renderer only draws blocks with positive overlap; touching this edge is still offscreen.
				if (presentedDepth > 0) {
					if (horizontal) offset.x -= inward * presentedDepth;
					else offset.y -= inward * presentedDepth;
				}
				active = true;
				return;
			}
			if (presentedDepth <= 0) {
				entries?.delete(block);
				return;
			}
			// Start at the held edge; limit the correction when a single step goes far into the viewport.
			spring = createViewportSpring(frequency, releaseDistancePixels, springOptions);
			const correction = -inward * Math.min(presentedDepth, releaseDistancePixels);
			if (horizontal) spring.x = correction;
			else spring.y = correction;
			entry.spring = spring;
		}

		offset.x += Math.round(spring.x);
		offset.y += Math.round(spring.y);
		active = true;
	};

	return {
		beginFrame(
			lastX: number,
			lastY: number,
			viewport: Bounds,
			time: number,
			elapsedMs: number,
			allowEntrances: boolean
		): void {
			frame++;
			active = false;
			previousX = lastX;
			previousY = lastY;
			viewX = viewport.x;
			viewY = viewport.y;
			viewWidth = viewport.width;
			viewHeight = viewport.height;
			frameTime = time;
			elapsedSeconds = elapsedMs / 1000;
			detectEntrances = allowEntrances;
		},
		resolve,
		hasMotion: () => active,
		reset(): void {
			entries = undefined;
			active = false;
			detectEntrances = false;
		},
	};
}
