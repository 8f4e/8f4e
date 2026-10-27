import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
import type { Meter } from '../types';

const overloadHoldByMeter = new WeakMap<Meter, true>();

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

function drawSegment(
	engine: DrawContext,
	startX: number,
	endX: number,
	fillWidth: number,
	color: PaletteIndex,
	height: number
): void {
	const segmentStart = Math.floor(startX);
	const segmentEnd = Math.floor(endX);
	const width = Math.min(segmentEnd - segmentStart, Math.max(0, fillWidth - segmentStart));

	if (width <= 0) {
		return;
	}

	engine.drawFill(segmentStart, 0, color, width, height);
}

export default function drawMeter(engine: DrawContext, values: Meter[], memoryViews: MemoryViews): void {
	const colors = PALETTE_INDICES;

	for (const meter of values) {
		const {
			x,
			y,
			width,
			height,
			baseSampleShift,
			valueType,
			minValue,
			maxValue,
			isBipolar,
			amplitudeLimit,
			inverseValueRange,
			greenEndX,
			yellowEndX,
			overloadMarkerX,
			overloadMarkerWidth,
		} = meter;
		engine.startGroup(x, y);

		const values = memoryViews[valueType];
		const valueIndex =
			meter.staticValueIndex ??
			memoryViews.int32[meter.memory.memory.allocationUnitAddress + meter.memory.bufferPointer] >> baseSampleShift;
		const value = values[valueIndex] ?? minValue;
		const normalized = isBipolar
			? clamp(Math.abs(value) / amplitudeLimit, 0, 1)
			: clamp((value - minValue) * inverseValueRange, 0, 1);
		const fillWidth = Math.round(normalized * width);
		const overloaded = isBipolar ? Math.abs(value) > amplitudeLimit : value < minValue || value > maxValue;

		engine.drawFill(0, 0, colors.darkSurface, width, height);
		drawSegment(engine, 0, greenEndX, fillWidth, colors.positiveBase, height);
		drawSegment(engine, greenEndX, yellowEndX, fillWidth, colors.warningBase, height);
		drawSegment(engine, yellowEndX, width, fillWidth, colors.negativeBase, height);

		if (overloaded) {
			overloadHoldByMeter.set(meter, true);
		}

		if (overloadHoldByMeter.has(meter)) {
			engine.drawFill(overloadMarkerX, 0, colors.negativeBase, overloadMarkerWidth, height);
		}

		engine.endGroup();
	}
}
