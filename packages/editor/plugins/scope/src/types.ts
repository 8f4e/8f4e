import type { PreparedNumericRead } from '@8f4e/editor-state/memory';

/** JavaScript-owned circular storage; the first count slots are populated, and writeIndex is the next slot. */
export interface ScopeHistory {
	values: Float64Array;
	count: number;
	writeIndex: number;
}

export interface Scope {
	/** Identity of the configured value and sampling rate, independent of layout geometry. */
	key: string;
	x: number;
	y: number;
	width: number;
	height: number;
	minValue: number;
	maxValue: number;
	sampleRate: number;
	read: PreparedNumericRead;
	/** Fixed capacity of one sample per horizontal pixel. */
	history: ScopeHistory;
}
