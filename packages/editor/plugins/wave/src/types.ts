import type { PreparedAddressBinding, PreparedBuffer } from '@8f4e/editor-state/memory';

export interface Wave {
	x: number;
	y: number;
	width: number;
	height: number;
	buffer: PreparedBuffer;
	playhead?: PreparedAddressBinding;
	inverseElementByteSize: number;
	minValue: number;
	maxValue: number;
	inverseValueRange: number;
}
