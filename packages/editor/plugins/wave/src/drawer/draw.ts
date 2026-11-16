import type { PaletteIndex } from '@8f4e/editor-palette';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { readByteAddress, readElementCount, readElementIndex } from '@8f4e/editor-state/memory';
import type { State } from '@8f4e/editor-state-types';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
import { updateWaveformPeaks, type WaveformPeaks } from '../helpers/peaks';
import type { Wave } from '../types';

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

function valueToY(value: number, minValue: number, inverseValueRange: number, height: number): number {
	const normalized = (value - minValue) * inverseValueRange;
	return clamp(height - 1 - Math.round(normalized * (height - 1)), 0, height - 1);
}

function drawWaveform(
	engine: DrawContext,
	peaks: WaveformPeaks,
	height: number,
	columnWidth: number,
	minValue: number,
	maxValue: number,
	inverseValueRange: number,
	color: PaletteIndex
): void {
	for (let column = 0; column < peaks.minima.length; column++) {
		const clampedMin = clamp(peaks.minima[column], minValue, maxValue);
		const clampedMax = clamp(peaks.maxima[column], minValue, maxValue);
		const minY = valueToY(clampedMin, minValue, inverseValueRange, height);
		const maxY = valueToY(clampedMax, minValue, inverseValueRange, height);
		const rectY = Math.min(minY, maxY);
		const rectHeight = Math.max(1, Math.abs(maxY - minY) + 1);

		engine.drawFill(column * columnWidth, rectY, color, columnWidth, rectHeight);
	}
}

export default function drawWaves(engine: DrawContext, state: State, waves: Wave[], memoryViews: MemoryViews): void {
	const colors = PALETTE_INDICES;

	for (const wave of waves) {
		const { x, y, width, height, buffer, inverseElementByteSize, playhead, minValue, maxValue, inverseValueRange } =
			wave;
		engine.startGroup(x, y);

		const arrayLength = readElementCount(buffer.elementCount, memoryViews) ?? 0;
		const baseValueIndex = readElementIndex(buffer.samples, memoryViews.int32);
		if (arrayLength <= 0 || baseValueIndex === undefined) {
			engine.endGroup();
			continue;
		}

		const values = memoryViews[buffer.samples.spec.valueType];
		const columnCount = wave.peaks.minima.length;
		const columnWidth = Math.max(1, Math.floor(width / columnCount));
		updateWaveformPeaks(wave.peaks, values, baseValueIndex, arrayLength);
		engine.drawFill(0, 0, colors.darkSurface, width, height);
		drawWaveform(engine, wave.peaks, height, columnWidth, minValue, maxValue, inverseValueRange, colors.highlightBase);

		if (playhead) {
			const startPointerValue = readByteAddress(buffer.samples.address, memoryViews.int32)!;
			const pointerValue = readByteAddress(playhead, memoryViews.int32);
			if (pointerValue === undefined) {
				engine.endGroup();
				continue;
			}
			const pointerIndex = Math.floor((pointerValue - startPointerValue) * inverseElementByteSize);
			const clampedIndex = Math.max(0, Math.min(pointerIndex, arrayLength - 1));
			const scanlineWidth = state.viewport.vGrid / 2;
			const scanlineX = arrayLength <= 1 ? 0 : Math.floor((clampedIndex / (arrayLength - 1)) * (width - scanlineWidth));

			engine.drawFill(scanlineX, 0, colors.secondaryReadable, scanlineWidth, height);
		}

		engine.endGroup();
	}
}
