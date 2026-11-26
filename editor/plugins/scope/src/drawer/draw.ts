import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { DrawContext } from '@8f4e/web-ui';
import type { Scope } from '../types';

/** Plot the JavaScript history only; drawing never reads or samples live memory. */
export default function drawScopes(draw: DrawContext, scopes: readonly Scope[]): void {
	for (const { x, y, width, height, history, minValue, maxValue } of scopes) {
		draw.startGroup(x, y);
		draw.drawFill(0, 0, PALETTE_INDICES.darkSurface, width, height);
		const startX = width - history.count;
		const valueRange = maxValue - minValue;
		// Once full, the next write slot also identifies the oldest sample.
		let sampleIndex = history.count === history.values.length ? history.writeIndex : 0;
		for (let index = 0; index < history.count; index++) {
			const normalized = Math.max(0, Math.min(1, (history.values[sampleIndex] - minValue) / valueRange));
			const pointY = height - 1 - Math.round(normalized * (height - 1));
			draw.drawFill(startX + index, pointY, PALETTE_INDICES.onDarkAccent, 1, 1);
			sampleIndex++;
			if (sampleIndex === history.values.length) sampleIndex = 0;
		}
		draw.endGroup();
	}
}
