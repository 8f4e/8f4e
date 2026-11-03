import type { Direction } from './utils/types';

/** Move focus to the nearest code block in the given direction. */
export interface NavigateCodeBlockEvent {
	direction: Direction;
}
