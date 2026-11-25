import type { ResolvedElasticViewportOptions } from './options';
import { createViewportSpring, createViewportSpringSolver, type ViewportSpring } from './spring';

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
	const advanceRelease = createViewportSpringSolver(frequency, releaseDistancePixels, springOptions);
	let entries: WeakMap<Bounds, Entry> | undefined;
	let frame = 0;
	let active = false;
	let previousLeft = 0;
	let previousTop = 0;
	let previousRight = 0;
	let previousBottom = 0;
	let viewLeft = 0;
	let viewTop = 0;
	let viewRight = 0;
	let viewBottom = 0;
	let horizontalTravel = 0;
	let verticalTravel = 0;
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

		const { x, y } = block;
		const right = x + block.width;
		const bottom = y + block.height;
		if (x >= viewRight || y >= viewBottom || right <= viewLeft || bottom <= viewTop) {
			if (entry) entries?.delete(block);
			return;
		}

		let spring = entry?.spring;
		if (entry && spring) {
			if (!advanceRelease(spring, elapsedSeconds, 0, 0)) {
				entries?.delete(block);
				return;
			}
			entry.frame = frame;
		} else {
			let edge = entry?.edge;
			if (!edge) {
				const xEdge = right <= previousLeft ? 'left' : x >= previousRight ? 'right' : undefined;
				const yEdge = bottom <= previousTop ? 'top' : y >= previousBottom ? 'bottom' : undefined;
				if (xEdge && yEdge) {
					// At a corner, use whichever edge was crossed last along this pan step.
					const xDepth = xEdge === 'left' ? right - viewLeft : viewRight - x;
					const yDepth = yEdge === 'top' ? bottom - viewTop : viewBottom - y;
					edge = xDepth / horizontalTravel <= yDepth / verticalTravel ? xEdge : yEdge;
				} else {
					edge = xEdge ?? yEdge;
				}
			}
			if (!edge) return;

			const horizontal = edge === 'left' || edge === 'right';
			const inward = edge === 'left' || edge === 'top' ? 1 : -1;
			const depth =
				edge === 'left'
					? right - viewLeft
					: edge === 'right'
						? viewRight - x
						: edge === 'top'
							? bottom - viewTop
							: viewBottom - y;
			const presentedDepth = depth + inward * (horizontal ? offset.x : offset.y);
			if (!entry) {
				entries ??= new WeakMap();
				entry = { edge, frame, lastDepth: depth, lastPullTime: frameTime };
				entries.set(block, entry);
			}
			entry.frame = frame;
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
			spring = createViewportSpring();
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
			viewLeft = viewport.x;
			viewTop = viewport.y;
			viewRight = viewLeft + viewport.width;
			viewBottom = viewTop + viewport.height;
			if (allowEntrances) {
				previousLeft = lastX;
				previousTop = lastY;
				previousRight = lastX + viewport.width;
				previousBottom = lastY + viewport.height;
				horizontalTravel = Math.abs(viewLeft - lastX);
				verticalTravel = Math.abs(viewTop - lastY);
			}
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
