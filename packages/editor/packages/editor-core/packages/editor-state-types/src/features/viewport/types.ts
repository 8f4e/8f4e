/**
 * Types for viewport feature - manages camera position and coordinate system conversions.
 */

import type { GridCoordinates } from '../../shared/types';

/**
 * Project-level viewport using grid coordinates.
 * Used in Project for persistent storage - converted to pixel coordinates at runtime.
 */
export interface ProjectViewport {
	gridCoordinates: GridCoordinates;
}

/** Character-cell dimensions in pixels. Supplied grid sizes must be positive. */
export interface GridSize {
	vGrid: number;
	hGrid: number;
}

export interface Viewport extends GridSize {
	width: number;
	height: number;
	x: number;
	y: number;
}

/** Canvas movement from wheel input, independent of pointer button state. */
export interface ViewportScrollEvent {
	movementX: number;
	movementY: number;
	/** An input layer may consume the scroll before the viewport pans. */
	stopPropagation: boolean;
}
