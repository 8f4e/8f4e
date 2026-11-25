import type { PreparedBuffer } from '@8f4e/editor-state/memory';

export interface Plot {
	x: number;
	y: number;
	width: number;
	height: number;
	minValue: number;
	maxValue: number;
	buffer: PreparedBuffer;
}
