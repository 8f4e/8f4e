import type {
	CodeBlockGraphicData,
	CodeBlockPointerDownEvent,
	EventDispatcher,
	InternalPointerEvent,
	State,
} from '@8f4e/editor-state-types';
import type { ButtonWidget } from '../types';

export function registerButtonInteraction(
	state: State,
	events: EventDispatcher,
	buttonsByBlock: WeakMap<CodeBlockGraphicData, ButtonWidget[]>,
	writeMemory: (address: number, value: number, isInteger: boolean) => void
): () => void {
	let pressedButton: ButtonWidget | undefined;
	const release = () => {
		if (!pressedButton) return;
		const button = pressedButton;
		pressedButton = undefined;
		writeMemory(button.allocationUnitAddress, button.offValue, button.isInteger);
	};
	const onPointerDown = (event: CodeBlockPointerDownEvent) => {
		const { x, y, codeBlock } = event;
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
		event.stopPropagation = true;
		writeMemory(pressedButton.allocationUnitAddress, pressedButton.onValue, pressedButton.isInteger);
	};
	events.on('codeBlockPointerDown', onPointerDown, { capture: true });
	events.on('codeBlockPointerUp', release);
	return () => {
		events.off('codeBlockPointerDown', onPointerDown);
		events.off('codeBlockPointerUp', release);
		release();
	};
}
