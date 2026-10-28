import type { FeatureFlags, FeatureFlagsConfig } from '@8f4e/editor-state-types';

/**
 * Default feature flags configuration with all features enabled.
 * Users can override these values when initializing the editor.
 */
export const defaultFeatureFlags: FeatureFlags = {
	contextMenu: true,
	moduleDragging: true,
	codeLineSelection: true,
	viewportDragging: true,
	editing: false,
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
