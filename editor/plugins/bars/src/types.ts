import type { PreparedBuffer } from '@8f4e/editor-state/memory';

export interface Bars {
	width: number;
	height: number;
	x: number;
	y: number;
	minValue: number;
	inverseValueRange: number;
	buffer: PreparedBuffer;
}
