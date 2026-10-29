import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { createSwitchDirective, type SwitchWidget } from './directive';

export function createSwitchPlugin({
	writeMemory,
}: {
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
}): EditorPlugin {
	return {
		id: 'switch',
		setup: ({ store, events, directives, drawers }) => {
			const state = store.getState();
			const widgets = new WeakMap<CodeBlockGraphicData, SwitchWidget[]>();
			const unregisterDirective = directives.register(createSwitchDirective(widgets));
			const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
				for (const control of widgets.get(codeBlock) ?? []) {
					const value = memoryViews.int32[control.allocationUnitAddress] || 0;
					if (value === control.onValue || value === control.offValue) {
						const isOn = value === control.onValue;
						const knobX = control.x + state.viewport.vGrid * (isOn ? 2 : 1);
						draw.drawFill(control.x, control.y, PALETTE_INDICES.accentSurface, control.width, control.height);
						draw.drawFill(knobX, control.y, PALETTE_INDICES.lightBase, state.viewport.vGrid, control.height);
						draw.drawText(control.x, control.y, isOn ? '[ |]' : '[| ]', PALETTE_INDICES.darkBase);
					} else {
						draw.drawText(control.x, control.y, '[__]', PALETTE_INDICES.secondaryBase);
					}
				}
			});
			const onPointerDown = ({ x, y, codeBlock }: { x: number; y: number; codeBlock: CodeBlockGraphicData }) => {
				const control = widgets
					.get(codeBlock)
					?.find(
						control =>
							x >= codeBlock.x + control.x - state.viewport.x &&
							x <= codeBlock.x + control.x + control.width - state.viewport.x &&
							y >= codeBlock.y + control.y - state.viewport.y &&
							y <= codeBlock.y + control.y + control.height - state.viewport.y
					);
				if (!control) return;
				const value = state.callbacks.getWordFromMemory?.(control.allocationUnitAddress);
				writeMemory(
					control.allocationUnitAddress,
					value === control.offValue ? control.onValue : control.offValue,
					control.isInteger
				);
			};
			events.on('codeBlockPointerDown', onPointerDown);
			return () => {
				events.off('codeBlockPointerDown', onPointerDown);
				unregisterDrawer();
				unregisterDirective();
			};
		},
	};
}
