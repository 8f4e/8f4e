import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { createSwitchDirective, type SwitchWidget } from './directive';

export const switchPlugin: EditorPlugin = {
	id: 'switch',
	setup: ({ store, events, directives, drawers }) => {
		const state = store.getState();
		const widgets = new WeakMap<CodeBlockGraphicData, SwitchWidget[]>();
		const unregisterDirective = directives.register(createSwitchDirective(widgets));
		const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
			const sprites = state.spriteLookups;
			if (!sprites) return;
			for (const control of widgets.get(codeBlock) ?? []) {
				const value = memoryViews.int32[control.allocationUnitAddress] || 0;
				if (value === control.onValue || value === control.offValue) {
					const isOn = value === control.onValue;
					const knobX = control.x + state.viewport.vGrid * (isOn ? 2 : 1);
					draw.drawSprite(control.x, control.y, sprites.fillColors.switchBackground, control.width, control.height);
					draw.drawSprite(knobX, control.y, sprites.fillColors.controlKnob, state.viewport.vGrid, control.height);
					draw.drawText(control.x, control.y, isOn ? '[ |]' : '[| ]', sprites.fontControlKnob);
				} else {
					draw.drawText(control.x, control.y, '[__]', sprites.fontNumbers);
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
			state.callbacks.setWordInMemory?.(
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
