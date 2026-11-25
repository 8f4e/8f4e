import type { PreparedNumericRead } from '@8f4e/editor-state/memory';

export interface Meter {
	width: number;
	height: number;
	x: number;
	y: number;
	minValue: number;
	maxValue: number;
	isBipolar: boolean;
	amplitudeLimit: number;
	inverseValueRange: number;
	greenEndX: number;
	yellowEndX: number;
	overloadMarkerX: number;
	overloadMarkerWidth: number;
	read: PreparedNumericRead;
}
