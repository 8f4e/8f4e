import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../drawContext';
import type { MemoryViews } from '../../types';
import type { EditorDrawerHost } from '../registry';
import drawArrow from './drawArrow';
import drawEntryOutlines from './drawEntryOutlines';

const corner = '+';

export default function drawModules(
	engine: DrawContext,
	state: State,
	memoryViews: MemoryViews,
	drawers?: EditorDrawerHost
): void {
	const { x, y } = state.viewport;

	const offsetX = -x;
	const offsetY = -y;

	engine.startGroup(offsetX, offsetY);
	drawEntryOutlines(engine, state);

	for (const codeBlock of state.codeBlockRendering.currentProject.blocks) {
		if (
			codeBlock.x + offsetX > -1 * codeBlock.width &&
			codeBlock.y + offsetY > -1 * codeBlock.height &&
			codeBlock.x + offsetX < state.viewport.width &&
			codeBlock.y + offsetY < state.viewport.height
		) {
			engine.startGroup(codeBlock.x, codeBlock.y);
			drawers?.drawCodeBlock({ draw: engine, state, codeBlock, memoryViews });

			const cornerColor =
				state.codeBlockRendering.selectedCodeBlock === codeBlock
					? PALETTE_INDICES.secondaryBase
					: PALETTE_INDICES.inkBase;

			engine.drawText(0, 0, corner, cornerColor);
			engine.drawText(codeBlock.width - state.viewport.vGrid, 0, corner, cornerColor);
			engine.drawText(0, codeBlock.height - state.viewport.hGrid, corner, cornerColor);
			engine.drawText(
				codeBlock.width - state.viewport.vGrid,
				codeBlock.height - state.viewport.hGrid,
				corner,
				cornerColor
			);

			engine.endGroup();
		} else if (state.featureFlags.offscreenBlockArrows) {
			// Module is off-screen, draw arrow indicators
			drawArrow(engine, codeBlock, state);
		}
	}

	engine.endGroup();
}
