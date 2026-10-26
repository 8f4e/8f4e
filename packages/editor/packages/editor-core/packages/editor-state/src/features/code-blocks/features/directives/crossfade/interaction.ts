import type {
	CodeBlockGraphicData,
	Crossfade,
	EventDispatcher,
	InternalMouseEvent,
	State,
} from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import findCrossfadeWidgetAtViewportCoordinates from './findWidgetAtViewportCoordinates';

interface ActiveCrossfade {
	crossfade: Crossfade;
	codeBlock: CodeBlockGraphicData;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

export default function crossfade(store: StateManager<State>, events: EventDispatcher): () => void {
	const state = store.getState();
	let activeCrossfade: ActiveCrossfade | null = null;

	const updateCrossfadeValue = (x: number) => {
		if (!activeCrossfade) {
			return;
		}

		const { crossfade, codeBlock } = activeCrossfade;
		const relativeX = x - (codeBlock.x + crossfade.x - state.viewport.x);
		const normalized = clamp((relativeX - crossfade.handleWidth / 2) / crossfade.trackWidth, 0, 1);
		const position = normalized * 2 - 1;
		const leftValue = (1 - position) / 2;
		const rightValue = (1 + position) / 2;

		state.callbacks?.setWordInMemory?.(crossfade.leftWordAddress, leftValue, false);
		state.callbacks?.setWordInMemory?.(crossfade.rightWordAddress, rightValue, false);
	};

	const onCodeBlockPointerDown = ({ x, y, codeBlock }: { x: number; y: number; codeBlock: CodeBlockGraphicData }) => {
		const crossfade = findCrossfadeWidgetAtViewportCoordinates(state, codeBlock, x, y);

		if (!crossfade || !codeBlock.name) {
			return;
		}

		activeCrossfade = { crossfade, codeBlock };
		state.codeBlockRendering.draggedCodeBlock = undefined;
		updateCrossfadeValue(x);
	};

	const onMouseMove = (event: InternalMouseEvent) => {
		if (!activeCrossfade) {
			return;
		}

		updateCrossfadeValue(event.x);
		event.stopPropagation = true;
	};

	const onMouseUp = () => {
		activeCrossfade = null;
	};

	events.on('codeBlockPointerDown', onCodeBlockPointerDown);
	events.on('mousemove', onMouseMove);
	events.on('mouseup', onMouseUp);

	return () => {
		events.off('codeBlockPointerDown', onCodeBlockPointerDown);
		events.off('mousemove', onMouseMove);
		events.off('mouseup', onMouseUp);
	};
}
