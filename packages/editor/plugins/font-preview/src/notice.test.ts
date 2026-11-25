import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import { FONT_CATALOG, textToGlyphIds } from '@8f4e/sprite-generator';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { project, setup } from './__tests__/setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setupNotice() {
	const test = setup();
	Object.assign(test.state.viewport, { width: 640, height: 480, vGrid: 8, hGrid: 16 });
	const draw = { startGroup: vi.fn(), endGroup: vi.fn(), drawFill: vi.fn(), drawSprite: vi.fn() };
	const render = () => {
		for (const method of Object.values(draw)) method.mockClear();
		test.drawCanvasOverlays({
			draw: draw as unknown as DrawContext,
			state: test.state,
			viewport: test.state.viewport,
			blockPositions: { ordered: [], byCodeBlock: new Map() },
			memoryViews: {} as MemoryViews,
		});
	};
	const characters = () => draw.drawSprite.mock.calls.slice(-256);
	const textRows = (color: PaletteIndex) => {
		const rows = new Map<number, number[]>();
		for (const [, y, id, spriteColor] of draw.drawSprite.mock.calls.slice(0, -256)) {
			if (spriteColor !== color) continue;
			const row = rows.get(y) ?? [];
			row.push(id);
			rows.set(y, row);
		}
		return [...rows.values()];
	};
	return { ...test, draw, render, characters, textRows };
}

describe('font credit notice', () => {
	it('shows all 256 character slots exactly once in a 16 by 16 grid, including blank slots', () => {
		const test = setupNotice();
		test.events.dispatch('fontChanged', { font: 'ibmvga8x16' });
		test.render();
		const characters = test.characters();
		expect(characters.map(call => call[2])).toEqual(Array.from({ length: 256 }, (_, index) => index));
		expect(new Set(characters.map(call => call[0])).size).toBe(16);
		expect(new Set(characters.map(call => call[1])).size).toBe(16);
	});

	it('shows the applied font and credits for three seconds without opening a modal', () => {
		const test = setupNotice();
		test.key('+', { ctrlKey: true });
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		const font = test.font();
		test.events.dispatch('fontChanged', { font });
		test.render();
		expect(test.textRows(PALETTE_INDICES.floatingAccent)).toContainEqual(textToGlyphIds(FONT_CATALOG[font].name));
		expect(test.textRows(PALETTE_INDICES.floatingInk)).toContainEqual(
			textToGlyphIds(FONT_CATALOG[font].credits.split('\n')[0])
		);
		expect(test.state.dialogStack).toEqual([]);
		expect(test.key('+', { ctrlKey: true }).defaultPrevented).toBe(true);
		vi.advanceTimersByTime(2999);
		test.render();
		expect(test.draw.drawFill).toHaveBeenCalledOnce();
		vi.advanceTimersByTime(1);
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
	});

	it('replaces the notice and restarts its timeout for the latest applied font', () => {
		const test = setupNotice();
		test.events.dispatch('fontChanged', { font: 'pixelcode6x12' });
		vi.advanceTimersByTime(2000);
		test.events.dispatch('fontChanged', { font: 'terminus8x16' });
		vi.advanceTimersByTime(1000);
		test.render();
		expect(test.textRows(PALETTE_INDICES.floatingAccent)).toContainEqual(textToGlyphIds('Terminus 8x16'));
		expect(test.textRows(PALETTE_INDICES.floatingAccent)).not.toContainEqual(textToGlyphIds('PixelCode 6x12'));
		vi.advanceTimersByTime(2000);
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
	});

	it('wraps text on resize and uses the settled grid when the applied font changes', () => {
		const test = setupNotice();
		test.events.dispatch('fontChanged', { font: 'departuremono7x14' });
		test.events.dispatch('resize', { canvasWidth: 160, canvasHeight: 480 });
		test.render();
		const [, , , width] = test.draw.drawFill.mock.calls[0];
		expect(width).toBeLessThanOrEqual(144);
		for (const row of [...test.textRows(PALETTE_INDICES.floatingAccent), ...test.textRows(PALETTE_INDICES.floatingInk)])
			expect(row.length).toBeLessThanOrEqual(16);
		Object.assign(test.state.viewport, { vGrid: 16, hGrid: 32 });
		test.events.dispatch('gridSizeChanged');
		test.events.dispatch('fontChanged', { font: 'spleen16x32' });
		test.render();
		expect(test.draw.drawFill.mock.calls[0][3]).toBeLessThanOrEqual(128);
		expect(test.draw.drawSprite.mock.calls[0][4]).toBeLessThan(16);
		expect(test.textRows(PALETTE_INDICES.floatingAccent)).toContainEqual(textToGlyphIds('Spleen 16x32'));
	});

	it('keeps the complete grid and credits within a small viewport with a large font', () => {
		const test = setupNotice();
		Object.assign(test.state.viewport, { width: 240, height: 256, vGrid: 16, hGrid: 32 });
		test.events.dispatch('fontChanged', { font: 'spleen16x32' });
		test.render();
		const [left, top] = test.draw.startGroup.mock.calls[0];
		const [, , , width, height] = test.draw.drawFill.mock.calls[0];
		expect(left).toBeGreaterThanOrEqual(0);
		expect(top).toBeGreaterThanOrEqual(0);
		expect(left + width).toBeLessThanOrEqual(240);
		expect(top + height).toBeLessThanOrEqual(256);
		for (const [x, y, , , cellWidth, cellHeight] of test.draw.drawSprite.mock.calls) {
			expect(x).toBeGreaterThanOrEqual(0);
			expect(y).toBeGreaterThanOrEqual(0);
			expect(cellWidth).toBeGreaterThan(0);
			expect(cellHeight).toBeGreaterThan(0);
			expect(x + cellWidth).toBeLessThanOrEqual(width + 0.000001);
			expect(y + cellHeight).toBeLessThanOrEqual(height + 0.000001);
		}
		expect(test.characters().map(call => call[2])).toEqual(Array.from({ length: 256 }, (_, index) => index));
	});

	it('clears the notice on project replacement and releases timers, listeners and drawing on disposal', () => {
		const test = setupNotice();
		test.events.dispatch('fontChanged', { font: 'pixelcode6x12' });
		test.events.dispatch('loadProject', { project: project() });
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		test.events.dispatch('fontChanged', { font: 'pixelcode6x12' });
		test.disposePlugin();
		expect(vi.getTimerCount()).toBe(0);
		test.events.dispatch('fontChanged', { font: 'terminus8x16' });
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
	});
});
