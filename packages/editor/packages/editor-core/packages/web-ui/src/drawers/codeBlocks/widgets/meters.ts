import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../../drawContext';
import type { MemoryViews } from '../../../types';
import { getTypedValueView } from './typedValueView';

const overloadHoldByMeter = new WeakMap<CodeBlockGraphicData['widgets']['arrayMeters'][number], true>();

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

function getMeterValueIndex(
	meter: CodeBlockGraphicData['widgets']['arrayMeters'][number],
	baseSampleShift: 0 | 1 | 2 | 3,
	memoryViews: MemoryViews
): number {
	if (meter.staticValueIndex !== undefined) {
		return meter.staticValueIndex;
	}

	const { memory } = meter;

	if (memory.showAddress) {
		return (memory.memory.byteAddress >> baseSampleShift) + memory.bufferPointer;
	}

	if (memory.memory.pointerDepth > 0) {
		return memoryViews.int32[memory.memory.allocationUnitAddress + memory.bufferPointer] >> baseSampleShift;
	}

	return (memory.memory.byteAddress >> baseSampleShift) + memory.bufferPointer;
}

function drawSegment(
	engine: DrawContext,
	startX: number,
	endX: number,
	fillWidth: number,
	sprite: 'positiveBase' | 'warningBase' | 'negativeBase',
	height: number,
	spriteIds: NonNullable<State['spriteLookups']>['fillColors']
): void {
	const segmentStart = Math.floor(startX);
	const segmentEnd = Math.floor(endX);
	const width = Math.min(segmentEnd - segmentStart, Math.max(0, fillWidth - segmentStart));

	if (width <= 0) {
		return;
	}

	engine.drawSprite(segmentStart, 0, spriteIds[sprite], width, height);
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

	const fillSprites = state.spriteLookups.fillColors;

	for (const meter of codeBlock.widgets.arrayMeters) {
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

		const values = getTypedValueView(memoryViews, valueType);
		const value = values[getMeterValueIndex(meter, baseSampleShift, memoryViews)] ?? minValue;
		const normalized = isBipolar
			? amplitudeLimit === 0
				? 0
				: clamp(Math.abs(value) / amplitudeLimit, 0, 1)
			: clamp((value - minValue) * inverseValueRange, 0, 1);
		const fillWidth = Math.round(normalized * width);
		const overloaded = isBipolar ? Math.abs(value) > amplitudeLimit : value < minValue || value > maxValue;

		engine.drawSprite(0, 0, fillSprites.darkSurface, width, height);
		drawSegment(engine, 0, greenEndX, fillWidth, 'positiveBase', height, fillSprites);
		drawSegment(engine, greenEndX, yellowEndX, fillWidth, 'warningBase', height, fillSprites);
		drawSegment(engine, yellowEndX, width, fillWidth, 'negativeBase', height, fillSprites);

		if (overloaded) {
			overloadHoldByMeter.set(meter, true);
		}

		if (overloadHoldByMeter.has(meter)) {
			engine.drawSprite(overloadMarkerX, 0, fillSprites.negativeBase, overloadMarkerWidth, height);
		}

		engine.endGroup();
	}
}
