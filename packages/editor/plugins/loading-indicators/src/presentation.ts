import type { EditorPluginContext, LoadingIndicator } from '@8f4e/editor-core';
import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';
import type { LoadingIndicatorsPluginOptions } from './options';
import { ORBIT_COLUMNS, ORBIT_GLYPH_FRAMES, ORBIT_ROWS } from './orbit';
import { installVisibility } from './visibility';

type TextSpan = { x: number; glyphs: GlyphIds; color: PaletteIndex };
type Row = { indicator: LoadingIndicator; y: number; width: number; spans: TextSpan[] };
// One cell before the orbit and one blank cell before the text panel's own padding.
const GUTTER_COLUMNS = ORBIT_COLUMNS + 2;
const MIN_TEXT_COLUMNS = 16;
const ORBIT_LINGER_MS = 500;
const RENDERS_PER_ORBIT_STEP = 3;

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
	{ store, events, renderRegistry }: Pick<EditorPluginContext, 'store' | 'events' | 'renderRegistry'>,
	options: Required<LoadingIndicatorsPluginOptions>
): () => void {
	const state = store.getState();
	let rows: Row[] = [];
	let bottom = 0;
	let rowHeight = 0;
	let columns = 0;
	let grid = 0;
	let canDrawOrbit = false;
	let orbitRender = 0;
	let orbitUntil = -Infinity;
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
		if (vGrid <= 0 || hGrid <= 0) {
			rows = [];
			canDrawOrbit = false;
			clearInterval(elapsedTimer);
			elapsedTimer = undefined;
			return;
		}
		grid = vGrid;
		rowHeight = hGrid;
		const availableColumns = Math.floor(width / grid);
		const availableRows = Math.floor(height / rowHeight);
		bottom = availableRows * rowHeight;
		const indicators = state.featureFlags.canvasOverlays
			? state.loadingIndicators.filter(visibility.isVisible).slice(0, Math.min(options.maxVisibleRows, availableRows))
			: [];
		const now = Date.now();
		if (now >= orbitUntil) orbitRender = 0;
		orbitUntil = state.loadingIndicators.reduce(
			(until, { finishedAt }) => (finishedAt === null ? Infinity : Math.max(until, finishedAt + ORBIT_LINGER_MS)),
			-Infinity
		);
		const fitsOrbit = availableRows >= ORBIT_ROWS && availableColumns > ORBIT_COLUMNS;
		canDrawOrbit = fitsOrbit && indicators.length > 0;
		columns = availableColumns - GUTTER_COLUMNS - 2;
		const fitsText = fitsOrbit && columns >= MIN_TEXT_COLUMNS;
		rows = fitsText
			? indicators.map((indicator, index) =>
					prepareRow(indicator, columns, grid, (index - indicators.length) * rowHeight, now)
				)
			: [];
		if (rows.some(row => row.indicator.status === 'loading')) {
			elapsedTimer ??= setInterval(updateElapsed, options.elapsedUpdateIntervalMs);
		} else {
			clearInterval(elapsedTimer);
			elapsedTimer = undefined;
		}
	};
	const visibility = installVisibility(store, prepare, options);
	const removeDrawer = renderRegistry.registerCanvasOverlay(({ draw }) => {
		const drawOrbit = canDrawOrbit && (orbitUntil === Infinity || Date.now() < orbitUntil);
		if (!rows.length && !drawOrbit) return;
		draw.startGroup(0, bottom);
		if (drawOrbit) {
			const reducedMotion = options.prefersReducedMotion();
			const step = reducedMotion ? 0 : Math.floor(orbitRender / RENDERS_PER_ORBIT_STEP);
			const frame = ORBIT_GLYPH_FRAMES[step];
			for (const [index, glyphs] of frame.entries()) {
				draw.drawGlyphs(grid, (index - ORBIT_ROWS) * rowHeight, glyphs, PALETTE_INDICES.floatingInk);
			}
			if (!reducedMotion) orbitRender = (orbitRender + 1) % (ORBIT_GLYPH_FRAMES.length * RENDERS_PER_ORBIT_STEP);
		}
		const textLeft = GUTTER_COLUMNS * grid;
		for (const row of rows) {
			draw.drawFill(textLeft, row.y, PALETTE_INDICES.floatingSurface, row.width, rowHeight);
			for (const span of row.spans) draw.drawGlyphs(textLeft + span.x, row.y, span.glyphs, span.color);
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
