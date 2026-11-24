import type { State } from '@8f4e/editor-state-types';
import type { MemoryViews } from '../memoryViews';
import type { FrameBlockPositions } from './blockPositions';

/** State shared by every canvas drawer and GPU layer during one frame. */
export interface FrameContext {
	state: State;
	/** The presented camera and installed grid dimensions for this frame. Do not retain across frames. */
	viewport: Readonly<State['viewport']>;
	memoryViews: MemoryViews;
	blockPositions: FrameBlockPositions;
}
