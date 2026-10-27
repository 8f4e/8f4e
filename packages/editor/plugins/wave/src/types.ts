import type { MemoryIdentifier, TypedValueKind } from '@8f4e/editor-state-types';

export interface Wave {
	x: number;
	y: number;
	width: number;
	height: number;
	source: MemoryIdentifier;
	elementCount: number | MemoryIdentifier;
	playhead?: MemoryIdentifier;
	inverseElementByteSize: number;
	baseSampleShift: 0 | 1 | 2 | 3;
	valueType: TypedValueKind;
	minValue: number;
	maxValue: number;
	inverseValueRange: number;
}
