import { FONT_CATALOG, textToGlyphIds } from '@8f4e/sprite-generator';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { project, setup } from './__tests__/setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setupNotice() {
	const test = setup();
	Object.assign(test.state.viewport, { width: 640, height: 480, vGrid: 8, hGrid: 16 });
	const draw = { startGroup: vi.fn(), endGroup: vi.fn(), drawFill: vi.fn(), drawGlyphs: vi.fn() };
	const render = () => {
		for (const method of Object.values(draw)) method.mockClear();
		test.drawCanvasOverlays({
			draw: draw as unknown as DrawContext,
			state: test.state,
			memoryViews: {} as MemoryViews,
		});
	};
	return { ...test, draw, render };
}

describe('font credit notice', () => {
	it('shows the applied font and credits for three seconds without opening a modal', () => {
		const test = setupNotice();
		test.key('F9');
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		test.events.dispatch('fontChanged', { font: 'pixelcode6x12' });
		test.render();
		expect(test.draw.drawGlyphs.mock.calls.map(call => call[2])).toContainEqual(
			textToGlyphIds(FONT_CATALOG.pixelcode6x12.name)
		);
		expect(test.draw.drawGlyphs.mock.calls.map(call => call[2])).toContainEqual(textToGlyphIds('Qwerasd'));
		expect(test.state.dialogStack).toEqual([]);
		expect(test.key('F9').defaultPrevented).toBe(true);
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
		expect(test.draw.drawGlyphs.mock.calls.map(call => call[2])).toContainEqual(textToGlyphIds('Terminus 8x16'));
		expect(test.draw.drawGlyphs.mock.calls.map(call => call[2])).not.toContainEqual(textToGlyphIds('PixelCode 6x12'));
		vi.advanceTimersByTime(2000);
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
	});

	it('wraps the name and credits on resize and when grid dimensions change', () => {
		const test = setupNotice();
		test.events.dispatch('fontChanged', { font: 'departuremono7x14' });
		test.events.dispatch('resize', { canvasWidth: 160, canvasHeight: 480 });
		test.render();
		const [, , , width] = test.draw.drawFill.mock.calls[0];
		expect(width).toBeLessThanOrEqual(144);
		for (const [, , glyphs] of test.draw.drawGlyphs.mock.calls) expect(glyphs.length).toBeLessThanOrEqual(16);
		test.state.viewport.vGrid = 16;
		test.events.dispatch('gridSizeChanged');
		test.render();
		for (const [, , glyphs] of test.draw.drawGlyphs.mock.calls) expect(glyphs.length).toBeLessThanOrEqual(6);
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
