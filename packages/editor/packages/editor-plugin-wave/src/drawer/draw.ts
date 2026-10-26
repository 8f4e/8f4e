import type { State } from '@8f4e/editor-state-types';
import type { SpriteId } from '@8f4e/sprite-generator';
import type { DrawContext, MemoryViews } from '@8f4e/web-ui';
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
	samples: ArrayLike<number>,
	baseIndex: number,
	arrayLength: number,
	height: number,
	columnWidth: number,
	columnCount: number,
	minValue: number,
	maxValue: number,
	inverseValueRange: number,
	waveformSpriteId: SpriteId
): void {
	for (let column = 0; column < columnCount; column++) {
		const sliceStart = Math.floor((column / columnCount) * arrayLength);
		const sliceEnd = Math.max(sliceStart + 1, Math.floor(((column + 1) / columnCount) * arrayLength));
		let sliceMin = Number.POSITIVE_INFINITY;
		let sliceMax = Number.NEGATIVE_INFINITY;

		for (let index = sliceStart; index < sliceEnd; index++) {
			const sampleValue = samples[baseIndex + index];
			sliceMin = Math.min(sliceMin, sampleValue);
			sliceMax = Math.max(sliceMax, sampleValue);
		}

		const clampedMin = clamp(sliceMin, minValue, maxValue);
		const clampedMax = clamp(sliceMax, minValue, maxValue);
		const minY = valueToY(clampedMin, minValue, inverseValueRange, height);
		const maxY = valueToY(clampedMax, minValue, inverseValueRange, height);
		const rectY = Math.min(minY, maxY);
		const rectHeight = Math.max(1, Math.abs(maxY - minY) + 1);

		engine.drawSprite(column * columnWidth, rectY, waveformSpriteId, columnWidth, rectHeight);
	}
}

export default function drawWaves(engine: DrawContext, state: State, waves: Wave[], memoryViews: MemoryViews): void {
	if (!state.spriteLookups) {
		return;
	}

	const fillSprites = state.spriteLookups.fillColors;

	for (const {
		x,
		y,
		width,
		height,
		source,
		inverseElementByteSize,
		baseSampleShift,
		elementCount,
		playhead,
		valueType,
		minValue,
		maxValue,
		inverseValueRange,
	} of waves) {
		engine.startGroup(x, y);

		const arrayLength =
			typeof elementCount === 'number'
				? elementCount
				: memoryViews.int32[elementCount.memory.allocationUnitAddress + elementCount.bufferPointer];
		if (arrayLength <= 0) {
			engine.endGroup();
			continue;
		}

		const startPointerValue = source.showAddress
			? source.memory.byteAddress
			: memoryViews.int32[source.memory.allocationUnitAddress + source.bufferPointer];
		const baseValueIndex = startPointerValue >> baseSampleShift;
		const values = memoryViews[valueType];
		const waveformColumnWidth = Math.max(1, Math.floor(state.viewport.vGrid / 2));
		const columnCount = Math.max(1, Math.floor(width / waveformColumnWidth));
		const columnWidth = Math.max(1, Math.floor(width / columnCount));
		engine.drawSprite(0, 0, fillSprites.darkSurface, width, height);
		drawWaveform(
			engine,
			values,
			baseValueIndex,
			arrayLength,
			height,
			columnWidth,
			columnCount,
			minValue,
			maxValue,
			inverseValueRange,
			fillSprites.highlightBase
		);

		if (playhead) {
			const pointerValue = playhead.showAddress
				? playhead.memory.byteAddress
				: memoryViews.int32[playhead.memory.allocationUnitAddress + playhead.bufferPointer];
			const pointerIndex = Math.floor((pointerValue - startPointerValue) * inverseElementByteSize);
			const clampedIndex = Math.max(0, Math.min(pointerIndex, arrayLength - 1));
			const scanlineWidth = state.viewport.vGrid / 2;
			const scanlineX = arrayLength <= 1 ? 0 : Math.floor((clampedIndex / (arrayLength - 1)) * (width - scanlineWidth));

			engine.drawSprite(scanlineX, 0, fillSprites.secondaryReadable, scanlineWidth, height);
		}

		engine.endGroup();
	}
}
