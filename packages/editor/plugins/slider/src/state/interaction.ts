import type { CodeBlockPointerMoveEvent } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { Slider } from '../types';

interface ActiveSlider {
	slider: Slider;
	codeBlock: CodeBlockGraphicData;
}

export function registerSliderInteraction(
	state: State,
	events: EventDispatcher,
	slidersByBlock: WeakMap<CodeBlockGraphicData, Slider[]>,
	writeMemory: (address: number, value: number, isInteger: boolean) => void
): () => void {
	let activeSlider: ActiveSlider | null = null;

	const updateSliderValue = ({ slider, codeBlock }: ActiveSlider, x: number) => {
		const relativeX = x - (codeBlock.x + slider.x - state.viewport.x);
		const normalizedValue = Math.max(0, Math.min(1, relativeX / slider.width));

		let value = slider.min + normalizedValue * (slider.max - slider.min);

		if (slider.step !== undefined) {
			value = slider.min + Math.round((value - slider.min) / slider.step) * slider.step;
		}

		const lowerBound = Math.min(slider.min, slider.max);
		const upperBound = Math.max(slider.min, slider.max);
		value = Math.max(lowerBound, Math.min(upperBound, value));

		const hasFloatRange =
			!Number.isInteger(slider.min) ||
			!Number.isInteger(slider.max) ||
			(slider.step !== undefined && !Number.isInteger(slider.step));
		const shouldWriteInteger = slider.isInteger && !hasFloatRange;

		writeMemory(slider.allocationUnitAddress, value, shouldWriteInteger);
	};

	const onCodeBlockPointerDown = (event: {
		x: number;
		y: number;
		codeBlock: CodeBlockGraphicData;
		stopPropagation?: boolean;
	}) => {
		const { x, y, codeBlock } = event;
		const slider = slidersByBlock
			.get(codeBlock)
			?.find(
				slider =>
					x >= codeBlock.x + slider.x - state.viewport.x &&
					x <= codeBlock.x + slider.x + slider.width - state.viewport.x &&
					y >= codeBlock.y + slider.y - state.viewport.y &&
					y <= codeBlock.y + slider.y + slider.height - state.viewport.y
			);

		if (!slider) {
			return;
		}

		event.stopPropagation = true;
		activeSlider = { slider, codeBlock };

		updateSliderValue(activeSlider, x);
	};

	const onPointerMove = (event: CodeBlockPointerMoveEvent) => {
		if (!activeSlider) {
			return;
		}

		updateSliderValue(activeSlider, event.x);
		event.stopPropagation = true;
	};

	const onPointerUp = () => {
		activeSlider = null;
	};

	events.on('codeBlockPointerDown', onCodeBlockPointerDown, { capture: true });
	events.on('codeBlockPointerMove', onPointerMove, { capture: true });
	events.on('codeBlockPointerUp', onPointerUp);

	return () => {
		events.off('codeBlockPointerDown', onCodeBlockPointerDown);
		events.off('codeBlockPointerMove', onPointerMove);
		events.off('codeBlockPointerUp', onPointerUp);
	};
}
