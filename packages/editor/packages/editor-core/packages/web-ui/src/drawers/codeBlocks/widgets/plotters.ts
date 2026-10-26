import type { PaletteIndex } from '@8f4e/editor-palette';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../../drawContext';
import type { MemoryViews } from '../../../types';
import { getBaseValueIndex, getTypedValueView } from './typedValueView';

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

function valueToY(
	value: number,
	minValue: number,
	valueRange: number,
	plotHeight: number,
	pointHeight: number
): number {
	const normalizedValue = valueRange === 0 ? 0.5 : (value - minValue) / valueRange;
	return clamp(
		plotHeight - pointHeight - Math.round(normalizedValue * (plotHeight - pointHeight)),
		0,
		plotHeight - pointHeight
	);
}

function drawSparsePlot(
	engine: DrawContext,
	values: ArrayLike<number>,
	baseValueIndex: number,
	width: number,
	columnWidth: number,
	plotHeight: number,
	pointHeight: number,
	minValue: number,
	valueRange: number,
	color: PaletteIndex
): void {
	for (let i = 0; i < width; i++) {
		const value = values[baseValueIndex + i];
		const pointY = valueToY(value, minValue, valueRange, plotHeight, pointHeight);
		engine.drawFill(i * columnWidth, pointY, color, columnWidth, pointHeight);
	}
}

function drawDensePlot(
	engine: DrawContext,
	values: ArrayLike<number>,
	baseValueIndex: number,
	arrayLength: number,
	columnCount: number,
	plotHeight: number,
	pointHeight: number,
	minValue: number,
	maxValue: number,
	valueRange: number,
	color: PaletteIndex
): void {
	for (let column = 0; column < columnCount; column++) {
		const sliceStart = Math.floor((column / columnCount) * arrayLength);
		const sliceEnd = Math.max(sliceStart + 1, Math.floor(((column + 1) / columnCount) * arrayLength));
		let sliceMin = Number.POSITIVE_INFINITY;
		let sliceMax = Number.NEGATIVE_INFINITY;

		for (let index = sliceStart; index < sliceEnd; index++) {
			const sampleValue = values[baseValueIndex + index];
			sliceMin = Math.min(sliceMin, sampleValue);
			sliceMax = Math.max(sliceMax, sampleValue);
		}

		const clampedMin = clamp(sliceMin, minValue, maxValue);
		const clampedMax = clamp(sliceMax, minValue, maxValue);
		const minY = valueToY(clampedMin, minValue, valueRange, plotHeight, pointHeight);
		const maxY = valueToY(clampedMax, minValue, valueRange, plotHeight, pointHeight);
		const rectY = Math.min(minY, maxY);
		const rectHeight = Math.max(pointHeight, Math.abs(maxY - minY) + pointHeight);

		engine.drawFill(column, rectY, color, 1, rectHeight);
	}
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

	const maxPlotterWidth = codeBlock.width - state.viewport.hGrid * 2;
	const plotHeight = state.viewport.hGrid * 8;
	const pointHeight = 1;

	for (const { x, y, startAddress, baseSampleShift, length, valueType, maxValue, minValue } of codeBlock.widgets
		.arrayPlotters) {
		engine.startGroup(x, y);

		const baseValueIndex = getBaseValueIndex(startAddress, memoryViews, baseSampleShift);
		const values = getTypedValueView(memoryViews, valueType);
		const arrayLength =
			typeof length === 'number'
				? length
				: memoryViews.int32[length.memory.allocationUnitAddress + length.bufferPointer];
		const sampleCount = Math.min(arrayLength || startAddress.memory.allocationUnitCount, maxPlotterWidth);
		const valueRange = maxValue - minValue;
		const columnWidth = Math.max(1, Math.floor(maxPlotterWidth / Math.max(sampleCount, 1)));
		const isDense = arrayLength > maxPlotterWidth;
		const plotWidth = isDense ? maxPlotterWidth : sampleCount * columnWidth;

		engine.drawFill(0, 0, colors.darkSurface, plotWidth, plotHeight);

		if (isDense) {
			drawDensePlot(
				engine,
				values,
				baseValueIndex,
				arrayLength,
				maxPlotterWidth,
				plotHeight,
				pointHeight,
				minValue,
				maxValue,
				valueRange,
				colors.onDarkAccent
			);
		} else {
			drawSparsePlot(
				engine,
				values,
				baseValueIndex,
				sampleCount,
				columnWidth,
				plotHeight,
				pointHeight,
				minValue,
				valueRange,
				colors.onDarkAccent
			);
		}

		engine.endGroup();
	}
}
