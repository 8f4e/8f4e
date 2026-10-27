import type { State } from '@8f4e/editor-state-types';
import type { LineDrawer } from '../../../plugins/line-drawer';
import type { MemoryViews } from '../../../types';
import type { WireColors } from '../../../wire-colors';

const WIRE_COLOR = 'wire';
const WIRE_HIGHLIGHTED_COLOR = 'wireHighlighted';
const WIRE_WIDTH = 1;
const WIRE_HIGHLIGHTED_WIDTH = 2;

export default function drawConnections(
	lines: LineDrawer,
	wireColors: WireColors,
	state: State,
	memoryViews: MemoryViews
): void {
	if (!state.spriteLookups) {
		return;
	}

	for (const codeBlock of state.codeBlockRendering.codeBlocks) {
		const isSelected = codeBlock === state.codeBlockRendering.selectedCodeBlock;

		if (!codeBlock.name) {
			continue;
		}

		for (const input of codeBlock.widgets.inputs) {
			const outputAddress = memoryViews.int32[input.allocationUnitAddress];
			const output = state.codeBlockRendering.outputsByWordAddress.get(outputAddress);

			if (!output) {
				continue;
			}

			lines.drawLine(
				codeBlock.x + input.wireX - state.viewport.x,
				codeBlock.y + input.wireY - state.viewport.y,
				output.codeBlock.x + output.wireX - state.viewport.x,
				output.codeBlock.y + output.wireY - state.viewport.y,
				isSelected ? WIRE_HIGHLIGHTED_WIDTH : WIRE_WIDTH,
				wireColors[isSelected ? WIRE_HIGHLIGHTED_COLOR : WIRE_COLOR]
			);
		}
	}
}
