import { createMockState } from '@8f4e/editor-state-testing';
import type { State } from '@8f4e/editor-state-types';

/** State defaults for isolated renderer screenshots. */
export default function createScreenshotState(overrides: Partial<State> = {}): State {
	return createMockState({
		featureFlags: {
			contextMenu: true,
			moduleDragging: false,
			codeLineSelection: true,
			viewportDragging: false,
			canvasOverlays: true,
		},
		editorMode: 'view',
		...overrides,
	});
}
