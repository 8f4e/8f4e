import type { EditorPluginContext, LoadingIndicator } from '@8f4e/editor-core';
import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';
import type { LoadingIndicatorsPluginOptions } from './options';
import { ORBIT_COLUMNS, ORBIT_FRAMES, ORBIT_ROWS, ORBIT_STEP_MS } from './orbit';
import { installVisibility } from './visibility';

type TextSpan = { x: number; glyphs: GlyphIds; color: PaletteIndex };
type Row = { indicator: LoadingIndicator; y: number; width: number; spans: TextSpan[] };
// One cell before the orbit and one blank cell before the text panel's own padding.
const GUTTER_COLUMNS = ORBIT_COLUMNS + 2;
const MIN_TEXT_COLUMNS = 16;
const ORBIT_LINGER_MS = 500;
const ORBIT_GLYPH_FRAMES = ORBIT_FRAMES.map(frame => frame.map(textToGlyphIds));

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
	if (message) spans.push({ x: grid, glyphs: textToGlyphIds(message), color: PALETTE_INDICES.floatingInk });
	if (statusText)
		spans.push({
			x: (message.length + 1) * grid,
			glyphs: textToGlyphIds(statusText),
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
			glyphs: textToGlyphIds(durationText),
			color: PALETTE_INDICES.floatingMuted,
		});
	return { indicator, y, width: (message.length + statusText.length + durationText.length + 2) * grid, spans };
}

/** Prepare the overlay layout outside drawing; let the orbit linger briefly after pending work settles. */
export function installPresentation(
	{ store, events, drawers }: Pick<EditorPluginContext, 'store' | 'events' | 'drawers'>,
	options: Required<LoadingIndicatorsPluginOptions>
): () => void {
	const state = store.getState();
	const motionPreference = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
	let rows: Row[] = [];
	let top = 0;
	let rowHeight = 0;
	let columns = 0;
	let grid = 0;
	let gutterWidth = 0;
	let orbitY = 0;
	let orbitVisibleUntil = 0;
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
		grid = vGrid;
		rowHeight = hGrid;
		const availableColumns = Math.max(0, Math.floor(width / grid) - 2);
		const availableRows = Math.floor(height / rowHeight);
		const gutterColumns =
			availableRows >= ORBIT_ROWS && availableColumns >= GUTTER_COLUMNS + MIN_TEXT_COLUMNS ? GUTTER_COLUMNS : 0;
		gutterWidth = gutterColumns * grid;
		columns = availableColumns - gutterColumns;
		const indicators =
			availableColumns && state.featureFlags.canvasOverlays
				? state.loadingIndicators.filter(visibility.isVisible).slice(0, Math.min(options.maxVisibleRows, availableRows))
				: [];
		if (state.loadingIndicators.some(indicator => indicator.status === 'loading')) {
			orbitVisibleUntil = Infinity;
		} else if (orbitVisibleUntil === Infinity) {
			orbitVisibleUntil = performance.now() + ORBIT_LINGER_MS;
		}
		const groupRows = gutterColumns && indicators.length ? Math.max(indicators.length, ORBIT_ROWS) : indicators.length;
		const textY = (groupRows - indicators.length) * rowHeight;
		orbitY = (groupRows - ORBIT_ROWS) * rowHeight;
		top = (availableRows - groupRows) * rowHeight;
		const now = Date.now();
		rows = indicators.map((indicator, index) => prepareRow(indicator, columns, grid, textY + index * rowHeight, now));
		if (indicators.some(indicator => indicator.status === 'loading')) {
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
		const frameTime = gutterWidth ? performance.now() : 0;
		if (gutterWidth && frameTime < orbitVisibleUntil) {
			// A project switch can replace the editor, but not the page's clock.
			const step = motionPreference?.matches ? 0 : Math.floor(frameTime / ORBIT_STEP_MS);
			const frame = ORBIT_GLYPH_FRAMES[step % ORBIT_GLYPH_FRAMES.length];
			for (const [index, glyphs] of frame.entries()) {
				draw.drawGlyphs(grid, orbitY + index * rowHeight, glyphs, PALETTE_INDICES.floatingInk);
			}
		}
		for (const row of rows) {
			draw.drawFill(gutterWidth, row.y, PALETTE_INDICES.floatingSurface, row.width, rowHeight);
			for (const span of row.spans) draw.drawGlyphs(gutterWidth + span.x, row.y, span.glyphs, span.color);
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
