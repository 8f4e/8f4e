import type { MemoryIdentifier, TypedValueKind } from '@8f4e/editor-state-types';

export interface Bars {
	width: number;
	height: number;
	x: number;
	y: number;
	minValue: number;
	inverseValueRange: number;
	startAddress: MemoryIdentifier;
	baseSampleShift: 0 | 1 | 2 | 3;
	length: number | MemoryIdentifier;
	valueType: TypedValueKind;
}
