import type { CodeBlockGraphicData, EventDispatcher, InternalMouseEvent, State } from '@8f4e/editor-state-types';
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

		value = Math.max(slider.min, Math.min(slider.max, value));

		const hasFloatRange =
			!Number.isInteger(slider.min) ||
			!Number.isInteger(slider.max) ||
			(slider.step !== undefined && !Number.isInteger(slider.step));
		const shouldWriteInteger = slider.isInteger && !hasFloatRange;

		writeMemory(slider.allocationUnitAddress, value, shouldWriteInteger);
	};

	const onCodeBlockPointerDown = ({ x, y, codeBlock }: { x: number; y: number; codeBlock: CodeBlockGraphicData }) => {
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

		activeSlider = { slider, codeBlock };
		state.codeBlockRendering.draggedCodeBlock = undefined;

		updateSliderValue(activeSlider, x);
	};

	const onMouseMove = (event: InternalMouseEvent) => {
		if (!activeSlider) {
			return;
		}

		updateSliderValue(activeSlider, event.x);
		event.stopPropagation = true;
	};

	const onMouseUp = () => {
		activeSlider = null;
	};

	events.on('codeBlockPointerDown', onCodeBlockPointerDown);
	events.on('mousemove', onMouseMove, { capture: true });
	events.on('mouseup', onMouseUp);

	return () => {
		events.off('codeBlockPointerDown', onCodeBlockPointerDown);
		events.off('mousemove', onMouseMove);
		events.off('mouseup', onMouseUp);
	};
}
