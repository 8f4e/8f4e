import type { FeatureFlags, FeatureFlagsConfig } from '@8f4e/editor-state-types';

/**
 * Default feature flags configuration. Editor mode is stored separately in state.editorMode.
 * Users can override these values when initializing the editor.
 */
export const defaultFeatureFlags: FeatureFlags = {
	contextMenu: true,
	moduleDragging: true,
	codeLineSelection: true,
	viewportDragging: true,
	modeToggling: true,
	modeOverlay: true,
	historyTracking: true,
	offscreenBlockArrows: true,
	projectCreation: true,
};

/**
 * Validates feature flags configuration and applies defaults for missing values.
 *
 * @param flags - Partial feature flags configuration
 * @returns Complete feature flags configuration with validated values
 */
export function validateFeatureFlags(flags: FeatureFlagsConfig = {}): FeatureFlags {
	return {
		...defaultFeatureFlags,
		...flags,
	};
}
