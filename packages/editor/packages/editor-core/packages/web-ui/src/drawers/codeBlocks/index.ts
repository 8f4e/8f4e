import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import type { WebUiRenderData } from '@8f4e/web-ui-render-projection';
import type { DrawContext } from '../../drawContext';
import type { MemoryViews } from '../../types';
import type { CodeBlockDrawerRegistry } from '../registry';
import drawArrow from './drawArrow';
import drawEntryOutlines from './drawEntryOutlines';
import drawSelectedOutline from './drawSelectedOutline';
import drawShapeDeclarations from './drawShapeDeclarations';
import drawAssertions from './widgets/assertions';
import drawBlockHighlights from './widgets/blockHighlights';
import drawConnectors from './widgets/connectors';
import drawErrorMessages from './widgets/errorMessages';
import drawInfoPanels from './widgets/infoPanels';

const corner = '+';

export default function drawModules(
	engine: DrawContext,
	state: State,
	memoryViews: MemoryViews,
	renderData: WebUiRenderData,
	drawers?: CodeBlockDrawerRegistry
): void {
	const { x, y } = state.viewport;

	const offsetX = -x;
	const offsetY = -y;

	engine.startGroup(offsetX, offsetY);
	drawEntryOutlines(engine, state);

	for (const codeBlock of state.codeBlockRendering.codeBlocks) {
		const codeCells = renderData.codeBlocks.get(codeBlock.creationIndex)?.codeCells ?? [];

		if (
			codeBlock.x + offsetX > -1 * codeBlock.width &&
			codeBlock.y + offsetY > -1 * codeBlock.height &&
			codeBlock.x + offsetX < state.viewport.width &&
			codeBlock.y + offsetY < state.viewport.height
		) {
			engine.startGroup(codeBlock.x, codeBlock.y);
			if (codeBlock === state.codeBlockRendering.draggedCodeBlock) {
				engine.drawFill(0, 0, PALETTE_INDICES.surfaceRaised1, codeBlock.width, codeBlock.height);
			} else if (codeBlock.disabled) {
				engine.drawFill(0, 0, PALETTE_INDICES.surfaceSubdued, codeBlock.width, codeBlock.height);
			} else {
				engine.drawFill(0, 0, PALETTE_INDICES.surfaceBase, codeBlock.width, codeBlock.height);
			}

			drawBlockHighlights(engine, codeBlock);

			if (state.featureFlags.codeLineSelection && state.codeBlockRendering.selectedCodeBlock === codeBlock) {
				engine.drawFill(0, codeBlock.cursor.y, PALETTE_INDICES.primarySoft, codeBlock.width, state.viewport.hGrid);
			}

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

			for (let i = 0; i < codeCells.length; i++) {
				engine.drawResolvedText(state.viewport.vGrid, state.viewport.hGrid * i, codeCells[i]);
			}

			drawShapeDeclarations(engine, codeBlock);

			if (state.featureFlags.editing && state.codeBlockRendering.selectedCodeBlock === codeBlock) {
				engine.drawText(
					codeBlock.cursor.x,
					codeBlock.cursor.y,
					'_',
					codeBlock.disabled ? PALETTE_INDICES.inkFaint : PALETTE_INDICES.inkBase
				);
			}
			drawAssertions(engine, codeBlock);

			if (state.codeBlockRendering.selectedCodeBlock === codeBlock) {
				drawSelectedOutline(engine, state, codeBlock.width, codeBlock.height);
			}

			drawErrorMessages(engine, state, codeBlock);
			drawers?.drawCodeBlock({ draw: engine, state, codeBlock, memoryViews });
			drawConnectors(engine, state, codeBlock, memoryViews);
			drawInfoPanels(engine, state, codeBlock);
			drawers?.drawCodeBlockOverlay({ draw: engine, state, codeBlock, memoryViews });

			engine.endGroup();
		} else if (state.featureFlags.offscreenBlockArrows) {
			// Module is off-screen, draw arrow indicators
			drawArrow(engine, codeBlock, state);
		}
	}

	engine.endGroup();
}
