import type {
	CodeBlockGraphicData,
	CodeBlockPointerDownEvent,
	EventDispatcher,
	InternalPointerEvent,
	State,
} from '@8f4e/editor-state-types';
import { INPUT_LAYERS } from '@8f4e/editor-state-types';
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
	crossfadesByBlock: WeakMap<CodeBlockGraphicData, Crossfade[]>,
	writeMemory: (address: number, value: number, isInteger: boolean) => void
): () => void {
	let activeCrossfade: ActiveCrossfade | null = null;

	const updateCrossfadeValue = ({ crossfade, codeBlock }: ActiveCrossfade, x: number) => {
		const relativeX = x - (codeBlock.x + crossfade.x - state.viewport.x);
		const normalized = clamp((relativeX - crossfade.handleWidth / 2) / crossfade.trackWidth, 0, 1);
		const position = normalized * 2 - 1;
		const leftValue = (1 - position) / 2;
		const rightValue = (1 + position) / 2;

		writeMemory(crossfade.leftWordAddress, leftValue, false);
		writeMemory(crossfade.rightWordAddress, rightValue, false);
	};

	const onCodeBlockPointerDown = (event: CodeBlockPointerDownEvent) => {
		const { x, y, codeBlock } = event;
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

		event.stopPropagation = true;
		activeCrossfade = { crossfade, codeBlock };
		updateCrossfadeValue(activeCrossfade, x);
	};

	const onPointerMove = (event: InternalPointerEvent) => {
		if (!activeCrossfade) {
			return;
		}

		updateCrossfadeValue(activeCrossfade, event.x);
		event.stopPropagation = true;
	};

	const onPointerUp = () => {
		activeCrossfade = null;
	};

	events.on('codeBlockPointerDown', onCodeBlockPointerDown, { capture: true, layer: INPUT_LAYERS.codeBlock });
	events.on('codeBlockPointerMove', onPointerMove, { capture: true, layer: INPUT_LAYERS.codeBlock });
	events.on('codeBlockPointerUp', onPointerUp, { layer: INPUT_LAYERS.codeBlock });

	return () => {
		events.off('codeBlockPointerDown', onCodeBlockPointerDown);
		events.off('codeBlockPointerMove', onPointerMove);
		events.off('codeBlockPointerUp', onPointerUp);
	};
}
