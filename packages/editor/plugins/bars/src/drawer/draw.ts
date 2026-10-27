import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
import type { Bars } from '../types';

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

function valueToBarHeight(value: number, minValue: number, inverseValueRange: number, height: number): number {
	if (height <= 0) {
		return 0;
	}

	const normalized = inverseValueRange === 0 ? 0 : clamp((value - minValue) * inverseValueRange, 0, 1);
	return Math.round(normalized * height);
}

export default function drawBars(engine: DrawContext, displays: Bars[], memoryViews: MemoryViews): void {
	const colors = PALETTE_INDICES;

	for (const bars of displays) {
		const { x, y, width, height, startAddress, baseSampleShift, length, valueType, minValue, inverseValueRange } = bars;
		engine.startGroup(x, y);

		const baseValueIndex =
			(startAddress.showAddress
				? startAddress.memory.byteAddress
				: memoryViews.int32[startAddress.memory.allocationUnitAddress + startAddress.bufferPointer]) >> baseSampleShift;
		const values = memoryViews[valueType];
		const arrayLength =
			typeof length === 'number'
				? length
				: memoryViews.int32[length.memory.allocationUnitAddress + length.bufferPointer];

		engine.drawFill(0, 0, colors.darkSurface, width, height);

		if (arrayLength <= 0) {
			engine.endGroup();
			continue;
		}

		const columnCount = Math.min(arrayLength, width);
		const columnWidth = Math.max(1, Math.floor(width / Math.max(columnCount, 1)));

		for (let column = 0; column < columnCount; column++) {
			const sliceStart = Math.floor((column / columnCount) * arrayLength);
			const sliceEnd = Math.max(sliceStart + 1, Math.floor(((column + 1) / columnCount) * arrayLength));
			let sliceMax = Number.NEGATIVE_INFINITY;

			for (let index = sliceStart; index < sliceEnd; index++) {
				sliceMax = Math.max(sliceMax, values[baseValueIndex + index]);
			}

			const barHeight = valueToBarHeight(sliceMax, minValue, inverseValueRange, height);
			if (barHeight <= 0) {
				continue;
			}

			const barX = column * columnWidth;
			const barY = height - barHeight;
			engine.drawFill(barX, barY, colors.detailBase, columnWidth, barHeight);
		}

		engine.endGroup();
	}
}
