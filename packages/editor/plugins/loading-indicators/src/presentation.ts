import type { EditorPluginContext, LoadingIndicator } from '@8f4e/editor-core';
import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import type { LoadingIndicatorsPluginOptions } from './options';
import { installVisibility } from './visibility';

type TextSpan = { x: number; text: string; color: PaletteIndex };
type Row = { indicator: LoadingIndicator; y: number; width: number; spans: TextSpan[] };

function formatElapsedTime(elapsed: number): string {
	return elapsed < 1000 ? `${Math.floor(elapsed)} ms` : `${(elapsed / 1000).toFixed(1)} s`;
}

function prepareRow(indicator: LoadingIndicator, columns: number, grid: number, y: number, now: number): Row {
	const elapsed = formatElapsedTime(Math.max(0, (indicator.finishedAt ?? now) - indicator.startedAt));
	const status = indicator.status === 'loading' ? '' : ` ${indicator.status}`;
	const duration = ` ${elapsed}`;
	const message = indicator.message.slice(0, Math.max(0, columns - status.length - duration.length));
	const statusText = status.slice(0, columns - message.length);
	const durationText = duration.slice(0, columns - message.length - statusText.length);
	const spans: TextSpan[] = [];
	if (message) spans.push({ x: grid, text: message, color: PALETTE_INDICES.floatingInk });
	if (statusText)
		spans.push({
			x: (message.length + 1) * grid,
			text: statusText,
			color:
				indicator.status === 'done'
					? PALETTE_INDICES.positiveBase
					: indicator.status === 'failed'
						? PALETTE_INDICES.negativeBase
						: PALETTE_INDICES.floatingMuted,
		});
	if (durationText)
		spans.push({
			x: (message.length + statusText.length + 1) * grid,
			text: durationText,
			color: PALETTE_INDICES.floatingMuted,
		});
	return { indicator, y, width: (message.length + statusText.length + durationText.length + 2) * grid, spans };
}

/** Prepare text on state/geometry changes; only visible pending rows need timed elapsed updates. */
export function installPresentation(
	{ store, events, drawers }: Pick<EditorPluginContext, 'store' | 'events' | 'drawers'>,
	options: Required<LoadingIndicatorsPluginOptions>
): () => void {
	const state = store.getState();
	let rows: Row[] = [];
	let top = 0;
	let rowHeight = 0;
	let columns = 0;
	let grid = 0;
	let elapsedTimer: ReturnType<typeof setInterval> | undefined;
	const updateElapsed = () => {
		const now = Date.now();
		for (let index = 0; index < rows.length; index++) {
			const row = rows[index];
			if (row.indicator.status === 'loading') rows[index] = prepareRow(row.indicator, columns, grid, row.y, now);
		}
	};
	const prepare = () => {
		const { width, height, vGrid, hGrid } = state.viewport;
		columns = Math.max(0, Math.floor(width / vGrid) - 2);
		const count = Math.min(options.maxVisibleRows, Math.max(0, Math.floor(height / hGrid) - 1));
		grid = vGrid;
		rowHeight = hGrid;
		const now = Date.now();
		rows =
			columns && state.featureFlags.canvasOverlays
				? state.loadingIndicators
						.filter(visibility.isVisible)
						.slice(0, count)
						.map((indicator, index) => prepareRow(indicator, columns, grid, index * rowHeight, now))
				: [];
		top = height - (rows.length + 1) * rowHeight;
		if (rows.some(row => row.indicator.status === 'loading')) {
			elapsedTimer ??= setInterval(updateElapsed, options.elapsedUpdateIntervalMs);
		} else {
			clearInterval(elapsedTimer);
			elapsedTimer = undefined;
		}
	};
	const visibility = installVisibility(store, prepare, options);
	const removeDrawer = drawers.registerCanvasOverlay(({ draw }) => {
		if (!rows.length) return;
		draw.startGroup(0, top);
		for (const row of rows) {
			draw.drawFill(0, row.y, PALETTE_INDICES.floatingSurface, row.width, rowHeight);
			for (const span of row.spans) draw.drawText(span.x, row.y, span.text, span.color);
		}
		draw.endGroup();
	});
	const selectors = [
		'loadingIndicators',
		'viewport.width',
		'viewport.height',
		'viewport.vGrid',
		'viewport.hGrid',
		'featureFlags.canvasOverlays',
	] as const;
	for (const selector of selectors) store.subscribe(selector, prepare);
	events.on('resize', prepare);
	events.on('gridSizeChanged', prepare);
	prepare();
	return () => {
		visibility.dispose();
		for (const selector of selectors) store.unsubscribe(selector, prepare);
		events.off('resize', prepare);
		events.off('gridSizeChanged', prepare);
		clearInterval(elapsedTimer);
		removeDrawer();
	};
}
