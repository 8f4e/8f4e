/** Optional presentation and visibility settings; all durations are in milliseconds. */
export interface LoadingIndicatorsPluginOptions {
	/** Maximum visible rows, further limited by the viewport. Defaults to 20. */
	maxVisibleRows?: number;
	/** Refresh interval for elapsed labels on visible pending rows. Defaults to 100. */
	elapsedUpdateIntervalMs?: number;
	/** Minimum spacing between hiding expired results. Defaults to 25. */
	hideIntervalMs?: number;
	/** Maximum operation duration for the fast done-result lifetime. Defaults to 100. */
	fastOperationThresholdMs?: number;
	/** Maximum operation duration for the medium done-result lifetime. Defaults to 500. */
	mediumOperationThresholdMs?: number;
	/** Visibility after a fast operation completes successfully. Defaults to 1000. */
	fastDoneVisibleMs?: number;
	/** Visibility after a medium operation completes successfully. Defaults to 2000. */
	mediumDoneVisibleMs?: number;
	/** Visibility after a slower operation completes successfully. Defaults to 3000. */
	slowDoneVisibleMs?: number;
	/** Visibility after an operation fails. Defaults to 5000. */
	failedVisibleMs?: number;
	/** Visibility after an operation is cancelled. Defaults to 5000. */
	cancelledVisibleMs?: number;
}
