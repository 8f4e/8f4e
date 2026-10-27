import type { MemoryIdentifier, TypedValueKind } from '@8f4e/editor-state-types';

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
	staticValueIndex?: number;
	memory: MemoryIdentifier;
	baseSampleShift: 0 | 1 | 2 | 3;
	valueType: TypedValueKind;
}
