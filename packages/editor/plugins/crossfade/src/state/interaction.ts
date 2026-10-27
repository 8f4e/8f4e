import type { CodeBlockGraphicData, EventDispatcher, InternalMouseEvent, State } from '@8f4e/editor-state-types';
import type { Crossfade } from '../types';

interface ActiveCrossfade {
	crossfade: Crossfade;
	codeBlock: CodeBlockGraphicData;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

export function registerCrossfadeInteraction(
	state: State,
	events: EventDispatcher,
	crossfadesByBlock: WeakMap<CodeBlockGraphicData, Crossfade[]>
): () => void {
	let activeCrossfade: ActiveCrossfade | null = null;

	const updateCrossfadeValue = ({ crossfade, codeBlock }: ActiveCrossfade, x: number) => {
		const relativeX = x - (codeBlock.x + crossfade.x - state.viewport.x);
		const normalized = clamp((relativeX - crossfade.handleWidth / 2) / crossfade.trackWidth, 0, 1);
		const position = normalized * 2 - 1;
		const leftValue = (1 - position) / 2;
		const rightValue = (1 + position) / 2;

		state.callbacks.setWordInMemory?.(crossfade.leftWordAddress, leftValue, false);
		state.callbacks.setWordInMemory?.(crossfade.rightWordAddress, rightValue, false);
	};

	const onCodeBlockPointerDown = ({ x, y, codeBlock }: { x: number; y: number; codeBlock: CodeBlockGraphicData }) => {
		const crossfade = crossfadesByBlock
			.get(codeBlock)
			?.find(
				value =>
					x >= codeBlock.x + value.x - state.viewport.x &&
					x <= codeBlock.x + value.x + value.width - state.viewport.x &&
					y >= codeBlock.y + value.y - state.viewport.y &&
					y <= codeBlock.y + value.y + value.height - state.viewport.y
			);

		if (!crossfade) {
			return;
		}

		activeCrossfade = { crossfade, codeBlock };
		state.codeBlockRendering.draggedCodeBlock = undefined;
		updateCrossfadeValue(activeCrossfade, x);
	};

	const onMouseMove = (event: InternalMouseEvent) => {
		if (!activeCrossfade) {
			return;
		}

		updateCrossfadeValue(activeCrossfade, event.x);
		event.stopPropagation = true;
	};

	const onMouseUp = () => {
		activeCrossfade = null;
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
