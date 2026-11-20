import type { PreparedNumericRead } from '@8f4e/editor-state/memory';

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
	/** Oldest to newest, with at most one sample per horizontal pixel. */
	history: number[];
}
