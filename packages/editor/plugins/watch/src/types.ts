import type { MemoryIdentifier } from '@8f4e/editor-state-types';

export interface WatchValue {
	x: number;
	y: number;
	resolveMemory: () => MemoryIdentifier | undefined;
	showEndAddress: boolean;
	displayFormat: 'decimal' | 'binary' | 'hex';
}
