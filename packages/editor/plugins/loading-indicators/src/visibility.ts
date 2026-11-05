import type { EditorPluginContext, LoadingIndicator } from '@8f4e/editor-core';
import type { LoadingIndicatorsPluginOptions } from './options';

function expiresAt(indicator: LoadingIndicator, options: Required<LoadingIndicatorsPluginOptions>): number | undefined {
	if (indicator.status === 'loading' || indicator.finishedAt === null) return undefined;
	const elapsed = indicator.finishedAt - indicator.startedAt;
	let displayDuration = options.slowDoneVisibleMs;
	if (indicator.status === 'failed') displayDuration = options.failedVisibleMs;
	else if (indicator.status === 'cancelled') displayDuration = options.cancelledVisibleMs;
	else if (elapsed <= options.fastOperationThresholdMs) displayDuration = options.fastDoneVisibleMs;
	else if (elapsed <= options.mediumOperationThresholdMs) displayDuration = options.mediumDoneVisibleMs;
	return indicator.finishedAt + displayDuration + 1;
}

/** Retain contributions in state; hide expired attempts using private, identity-based bookkeeping. */
export function installVisibility(
	store: EditorPluginContext['store'],
	onChange: () => void,
	options: Required<LoadingIndicatorsPluginOptions>
) {
	const hidden = new WeakSet<LoadingIndicator>();
	const isVisible = (indicator: LoadingIndicator) => !hidden.has(indicator);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let nextHideAt = 0;
	const schedule = () => {
		clearTimeout(timer);
		timer = undefined;
		let nextExpiry = Infinity;
		for (const indicator of store.getState().loadingIndicators) {
			if (!isVisible(indicator)) continue;
			const expiry = expiresAt(indicator, options);
			if (expiry !== undefined) nextExpiry = Math.min(nextExpiry, expiry);
		}
		if (nextExpiry === Infinity) return;
		const dueAt = Math.max(nextExpiry, nextHideAt);
		timer = setTimeout(hideOldest, Math.max(0, dueAt - Date.now()));
	};
	const hideOldest = () => {
		timer = undefined;
		const now = Date.now();
		let oldest: LoadingIndicator | undefined;
		let oldestFinishedAt = Infinity;
		for (const indicator of store.getState().loadingIndicators) {
			if (!isVisible(indicator)) continue;
			const expiry = expiresAt(indicator, options);
			if (expiry !== undefined && expiry <= now && indicator.finishedAt! < oldestFinishedAt) {
				oldest = indicator;
				oldestFinishedAt = indicator.finishedAt!;
			}
		}
		if (oldest) {
			hidden.add(oldest);
			nextHideAt = now + options.hideIntervalMs;
			onChange();
		}
		schedule();
	};
	store.subscribe('loadingIndicators', schedule);
	schedule();
	return {
		isVisible,
		dispose: () => {
			store.unsubscribe('loadingIndicators', schedule);
			clearTimeout(timer);
		},
	};
}
