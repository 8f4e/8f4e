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

export interface Viewport {
	width: number;
	height: number;
	vGrid: number;
	hGrid: number;
	x: number;
	y: number;
}
