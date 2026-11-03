import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
import { describe, expect, it, vi } from 'vitest';
import { setup } from './__tests__/setup';

function drawing() {
	const draw = { startGroup: vi.fn(), endGroup: vi.fn(), drawFill: vi.fn(), drawText: vi.fn() };
	const memoryViews: MemoryViews = {
		int8: new Int8Array(0),
		int16: new Int16Array(0),
		int32: new Int32Array(0),
		uint8: new Uint8Array(0),
		uint16: new Uint16Array(0),
		float32: new Float32Array(0),
		float64: new Float64Array(0),
	};
	return { draw, memoryViews };
}

describe('keyboard mode hints', () => {
	it.each([
		['view', "You're in view mode, press e to edit"],
		['edit', "You're in edit mode, press ESC to enter view mode"],
	] as const)('draws the %s hint through its canvas overlay', (mode, hint) => {
		const test = setup(mode);
		const { draw, memoryViews } = drawing();
		test.drawCanvasOverlays({ draw: draw as unknown as DrawContext, state: test.state, memoryViews });
		expect(draw.drawText).toHaveBeenCalledWith(test.state.viewport.vGrid, 0, hint, PALETTE_INDICES.mutedBase);
		expect(draw.drawFill).toHaveBeenCalledWith(
			0,
			0,
			PALETTE_INDICES.surfaceBase,
			(hint.length + 2) * test.state.viewport.vGrid,
			test.state.viewport.hGrid
		);
	});
	it('unregisters its overlay on disposal', () => {
		const test = setup();
		test.disposePlugin();
		const { draw, memoryViews } = drawing();
		test.drawCanvasOverlays({ draw: draw as unknown as DrawContext, state: test.state, memoryViews });
		expect(draw.drawText).not.toHaveBeenCalled();
	});
});
