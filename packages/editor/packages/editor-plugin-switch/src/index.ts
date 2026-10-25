import type { EditorPlugin } from '@8f4e/editor-core';
import type { BinaryControl, CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { drawBinaryControl } from '@8f4e/web-ui';
import { createSwitchDirective } from './directive';

export const switchPlugin: EditorPlugin = {
	id: 'switch',
	setup: ({ store, events, directives, drawers }) => {
		const state = store.getState();
		const widgets = new WeakMap<CodeBlockGraphicData, BinaryControl[]>();
		const unregisterDirective = directives.register(createSwitchDirective(widgets));
		const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock, memoryViews }) => {
			if (!state.spriteLookups) return;
			for (const control of widgets.get(codeBlock) ?? []) {
				const value = memoryViews.int32[control.allocationUnitAddress] || 0;
				if (value === control.onValue || value === control.offValue) {
					drawBinaryControl(draw, state, control, value === control.onValue);
				} else {
					draw.drawText(control.x, control.y, '[__]', state.spriteLookups.fontNumbers);
				}
			}
		});
		const onClick = ({ x, y, codeBlock }: { x: number; y: number; codeBlock: CodeBlockGraphicData }) => {
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
		events.on('codeBlockClick', onClick);
		return () => {
			events.off('codeBlockClick', onClick);
			unregisterDrawer();
			unregisterDirective();
		};
	},
};
