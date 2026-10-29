import { createMockState } from '@8f4e/editor-state-testing';
import type { State } from '@8f4e/editor-state-types';

/**
 * Create a mock state for web-ui screenshot tests.
 * Extends the base createMockState from editor-state with web-ui specific defaults.
 * Sprite lookups are populated when the web UI installs its generated atlas.
 *
 * @param overrides Optional partial state to override defaults
 * @returns A complete State object with web-ui defaults including color scheme and sprite data
 *
 * @example
 * ```typescript
 * const state = await createMockStateWithColors();
 * const state = await createMockStateWithColors({ editorMode: 'view' });
 * ```
 */
export default function createMockStateWithColors(overrides: Partial<State> = {}): State {
	return createMockState({
		featureFlags: {
			contextMenu: true,
			moduleDragging: false,
			codeLineSelection: true,
			viewportDragging: false,
			modeToggling: true,
			modeOverlay: true,
			offscreenBlockArrows: true,
		},
		editorMode: 'view',
		...overrides,
	});
}
