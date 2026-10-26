import type { CodeBlockGraphicData, EventDispatcher, State } from '@8f4e/editor-state-types';
import type { ButtonWidget } from '../types';

export function registerButtonInteraction(
	state: State,
	events: EventDispatcher,
	buttonsByBlock: WeakMap<CodeBlockGraphicData, ButtonWidget[]>
): () => void {
	let pressedButton: ButtonWidget | undefined;
	const release = () => {
		if (!pressedButton) return;
		const button = pressedButton;
		pressedButton = undefined;
		state.callbacks.setWordInMemory?.(button.allocationUnitAddress, button.offValue, button.isInteger);
	};
	const onPointerDown = ({ x, y, codeBlock }: { x: number; y: number; codeBlock: CodeBlockGraphicData }) => {
		pressedButton = buttonsByBlock
			.get(codeBlock)
			?.find(
				button =>
					x >= codeBlock.x + button.x - state.viewport.x &&
					x <= codeBlock.x + button.x + button.width - state.viewport.x &&
					y >= codeBlock.y + button.y - state.viewport.y &&
					y <= codeBlock.y + button.y + button.height - state.viewport.y
			);
		if (!pressedButton) return;
		state.callbacks.setWordInMemory?.(
			pressedButton.allocationUnitAddress,
			pressedButton.onValue,
			pressedButton.isInteger
		);
	};
	events.on('codeBlockPointerDown', onPointerDown);
	events.on('mouseup', release);
	return () => {
		events.off('codeBlockPointerDown', onPointerDown);
		events.off('mouseup', release);
		release();
	};
}
