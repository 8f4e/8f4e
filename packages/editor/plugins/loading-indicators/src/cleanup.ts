import type { EditorPluginContext, LoadingIndicator } from '@8f4e/editor-core';

function oldestFinished(indicators: readonly LoadingIndicator[]) {
	let index = -1;
	let finishedAt = Infinity;
	for (let position = 0; position < indicators.length; position++) {
		const time = indicators[position].finishedAt;
		if (time !== null && time < finishedAt) {
			index = position;
			finishedAt = time;
		}
	}
	return index === -1 ? undefined : { index, finishedAt };
}

/** Sleep until the first expiry, then space individual removals by at least 100 ms. */
export function installCleanup(store: EditorPluginContext['store']): () => void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let nextRemovalAt = 0;
	const schedule = () => {
		clearTimeout(timer);
		timer = undefined;
		const oldest = oldestFinished(store.getState().loadingIndicators);
		if (!oldest) return;
		const dueAt = Math.max(oldest.finishedAt + 5001, nextRemovalAt);
		timer = setTimeout(removeOldest, Math.max(0, dueAt - Date.now()));
	};
	const removeOldest = () => {
		timer = undefined;
		const indicators = store.getState().loadingIndicators;
		const oldest = oldestFinished(indicators);
		const now = Date.now();
		if (!oldest || now - oldest.finishedAt <= 5000) {
			schedule();
			return;
		}
		nextRemovalAt = now + 100;
		store.set('loadingIndicators', [...indicators.slice(0, oldest.index), ...indicators.slice(oldest.index + 1)]);
	};
	store.subscribe('loadingIndicators', schedule);
	schedule();
	return () => {
		store.unsubscribe('loadingIndicators', schedule);
		clearTimeout(timer);
	};
}
