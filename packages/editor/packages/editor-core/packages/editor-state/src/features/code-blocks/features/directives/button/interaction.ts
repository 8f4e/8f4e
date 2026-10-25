import type { Button, CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import findButtonWidgetAtViewportCoordinates from './findWidgetAtViewportCoordinates';

export default function button(state: State, events: EventDispatcher): () => void {
	let lastPushedButton: Button | undefined;

	const onCodeBlockClick = ({ x, y, codeBlock }: { x: number; y: number; codeBlock: CodeBlockGraphicData }) => {
		lastPushedButton = findButtonWidgetAtViewportCoordinates(state, codeBlock, x, y);

		if (!lastPushedButton) {
			return;
		}

		state.callbacks?.setWordInMemory?.(
			lastPushedButton.allocationUnitAddress,
			lastPushedButton.onValue,
			lastPushedButton.isInteger
		);
	};

	const onMouseUp = () => {
		if (!lastPushedButton) {
			return;
		}
		state.callbacks?.setWordInMemory?.(
			lastPushedButton.allocationUnitAddress,
			lastPushedButton.offValue,
			lastPushedButton.isInteger
		);
	};

	events.on('codeBlockClick', onCodeBlockClick);
	events.on('mouseup', onMouseUp);

	return () => {
		events.off('codeBlockClick', onCodeBlockClick);
		events.off('mouseup', onMouseUp);
	};
}
