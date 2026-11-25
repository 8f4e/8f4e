import type { Viewport } from '@8f4e/editor-state-types';

/**
 * Rounds pixel coordinates to the nearest grid lines.
 */
export default function roundToGrid(x: number, y: number, viewport: Viewport): [number, number] {
	return [Math.round(x / viewport.vGrid) * viewport.vGrid, Math.round(y / viewport.hGrid) * viewport.hGrid];
}
