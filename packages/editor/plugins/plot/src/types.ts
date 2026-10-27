import type { MemoryIdentifier, TypedValueKind } from '@8f4e/editor-state-types';

export interface Plot {
	x: number;
	y: number;
	width: number;
	height: number;
	minValue: number;
	maxValue: number;
	startAddress: MemoryIdentifier;
	baseSampleShift: 0 | 1 | 2 | 3;
	length: number | MemoryIdentifier;
	valueType: TypedValueKind;
}
