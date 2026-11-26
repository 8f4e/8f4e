import { createMockState } from '@8f4e/editor-state-testing';
import type { State } from '@8f4e/editor-state-types';

/** State defaults for isolated renderer screenshots. */
export default function createScreenshotState(overrides: Partial<State> = {}): State {
	return createMockState({
		editorMode: 'view',
		...overrides,
	});
}
