import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../../drawContext';
import type { MemoryViews } from '../../../types';
import { getBaseValueIndex as getBaseValueIndexFromTypedValueView, getTypedValueView } from './typedValueView';

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

function getBaseValueIndex(
	bars: CodeBlockGraphicData['widgets']['arrayBars'][number],
	memoryViews: MemoryViews
): number {
	if (bars.staticBaseValueIndex !== undefined) {
		return bars.staticBaseValueIndex;
	}

	return getBaseValueIndexFromStartAddress(bars.startAddress, memoryViews, bars.baseSampleShift);
}

function getBaseValueIndexFromStartAddress(
	startAddress: CodeBlockGraphicData['widgets']['arrayBars'][number]['startAddress'],
	memoryViews: MemoryViews,
	baseSampleShift: 0 | 1 | 2 | 3
): number {
	return getBaseValueIndexFromTypedValueView(startAddress, memoryViews, baseSampleShift);
}

export default function drawer(
	engine: DrawContext,
	state: State,
	codeBlock: CodeBlockGraphicData,
	memoryViews: MemoryViews
): void {
	if (!state.spriteLookups) {
		return;
	}

	const colors = PALETTE_INDICES;

	for (const bars of codeBlock.widgets.arrayBars) {
		const { x, y, width, height, length, valueType, minValue, inverseValueRange, staticColumnLayout } = bars;
		engine.startGroup(x, y);

		const baseValueIndex = getBaseValueIndex(bars, memoryViews);
		const values = getTypedValueView(memoryViews, valueType);
		const arrayLength =
			typeof length === 'number'
				? length
				: memoryViews.int32[length.memory.allocationUnitAddress + length.bufferPointer];

		engine.drawFill(0, 0, colors.darkSurface, width, height);

		if (arrayLength <= 0) {
			engine.endGroup();
			continue;
		}

		const columnLayout =
			staticColumnLayout && typeof length === 'number'
				? staticColumnLayout
				: Array.from({ length: Math.min(arrayLength, width) }, (_, column) => {
						const columnCount = Math.min(arrayLength, width);
						const columnWidth = Math.max(1, Math.floor(width / Math.max(columnCount, 1)));
						const sliceStart = Math.floor((column / columnCount) * arrayLength);
						return {
							x: column * columnWidth,
							width: columnWidth,
							sliceStart,
							sliceEnd: Math.max(sliceStart + 1, Math.floor(((column + 1) / columnCount) * arrayLength)),
						};
					});

		for (const column of columnLayout) {
			let sliceMax = Number.NEGATIVE_INFINITY;

			for (let index = column.sliceStart; index < column.sliceEnd; index++) {
				sliceMax = Math.max(sliceMax, values[baseValueIndex + index]);
			}

			const barHeight = valueToBarHeight(sliceMax, minValue, inverseValueRange, height);
			if (barHeight <= 0) {
				continue;
			}

			const barX = column.x;
			const barY = height - barHeight;
			engine.drawFill(barX, barY, colors.detailBase, column.width, barHeight);
		}

		engine.endGroup();
	}
}
