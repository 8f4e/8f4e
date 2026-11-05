import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';

function formatElapsedTime(elapsed: number): string {
	return elapsed < 1000 ? `${Math.floor(elapsed)} ms` : `${(elapsed / 1000).toFixed(1)} s`;
}

/** Presents contributed operations and gradually expires results older than five seconds. */
export const loadingIndicatorsPlugin: EditorPlugin = {
	id: 'loading-indicators',
	setup: ({ drawers, store }) => {
		const cleanup = setInterval(() => {
			const indicators = store.getState().loadingIndicators;
			const now = Date.now();
			let oldestIndex = -1;
			let oldestFinishedAt = Infinity;
			for (const [index, indicator] of indicators.entries()) {
				if (
					indicator.finishedAt !== null &&
					now - indicator.finishedAt > 5000 &&
					indicator.finishedAt < oldestFinishedAt
				) {
					oldestIndex = index;
					oldestFinishedAt = indicator.finishedAt;
				}
			}
			if (oldestIndex !== -1)
				store.set('loadingIndicators', [...indicators.slice(0, oldestIndex), ...indicators.slice(oldestIndex + 1)]);
		}, 100);
		const removeDrawer = drawers.registerCanvasOverlay(({ draw, state }) => {
			const { width, height, vGrid, hGrid } = state.viewport;
			const columns = Math.max(0, Math.floor(width / vGrid) - 2);
			const rows = Math.max(0, Math.floor(height / hGrid) - 1);
			const indicators = state.loadingIndicators.slice(0, rows);
			if (!columns || !indicators.length) return;
			const now = Date.now();
			draw.startGroup(0, height - (indicators.length + 1) * hGrid);
			for (const [row, indicator] of indicators.entries()) {
				const elapsed = formatElapsedTime(Math.max(0, (indicator.finishedAt ?? now) - indicator.startedAt));
				const status = indicator.status === 'loading' ? '' : ` ${indicator.status}`;
				const duration = ` ${elapsed}`;
				const message = indicator.message.slice(0, Math.max(0, columns - status.length - duration.length));
				const statusText = status.slice(0, columns - message.length);
				const durationText = duration.slice(0, columns - message.length - statusText.length);
				const length = message.length + statusText.length + durationText.length;
				draw.drawFill(0, row * hGrid, PALETTE_INDICES.floatingSurface, (length + 2) * vGrid, hGrid);
				if (message) draw.drawText(vGrid, row * hGrid, message, PALETTE_INDICES.floatingInk);
				if (statusText)
					draw.drawText(
						(message.length + 1) * vGrid,
						row * hGrid,
						statusText,
						indicator.status === 'done'
							? PALETTE_INDICES.positiveBase
							: indicator.status === 'failed'
								? PALETTE_INDICES.negativeBase
								: PALETTE_INDICES.floatingMuted
					);
				if (durationText)
					draw.drawText(
						(message.length + statusText.length + 1) * vGrid,
						row * hGrid,
						durationText,
						PALETTE_INDICES.floatingMuted
					);
			}
			draw.endGroup();
		});
		return () => {
			clearInterval(cleanup);
			removeDrawer();
		};
	},
};
