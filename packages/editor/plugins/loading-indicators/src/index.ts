import type { EditorPlugin } from '@8f4e/editor-core';
import type { LoadingIndicatorsPluginOptions } from './options';
import { installPresentation } from './presentation';

export type { LoadingIndicatorsPluginOptions } from './options';

/** Creates loading-indicator presentation with optional row limits and lifecycle timings. */
export function createLoadingIndicatorsPlugin({
	maxVisibleRows = 20,
	elapsedUpdateIntervalMs = 100,
	hideIntervalMs = 25,
	fastOperationThresholdMs = 100,
	mediumOperationThresholdMs = 500,
	fastDoneVisibleMs = 1000,
	mediumDoneVisibleMs = 2000,
	slowDoneVisibleMs = 3000,
	failedVisibleMs = 5000,
	cancelledVisibleMs = 5000,
}: LoadingIndicatorsPluginOptions = {}): EditorPlugin {
	const options = {
		maxVisibleRows,
		elapsedUpdateIntervalMs,
		hideIntervalMs,
		fastOperationThresholdMs,
		mediumOperationThresholdMs,
		fastDoneVisibleMs,
		mediumDoneVisibleMs,
		slowDoneVisibleMs,
		failedVisibleMs,
		cancelledVisibleMs,
	};
	return {
		id: 'loading-indicators',
		setup: context => installPresentation(context, options),
	};
}

/** Default presentation instance for compositions that do not need custom settings. */
export const loadingIndicatorsPlugin = createLoadingIndicatorsPlugin();
