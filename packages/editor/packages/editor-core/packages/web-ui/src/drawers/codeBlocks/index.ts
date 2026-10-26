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
import drawBars from './widgets/bars';
import drawBlockHighlights from './widgets/blockHighlights';
import drawConnectors from './widgets/connectors';
import drawCrossfades from './widgets/crossfades';
import drawDebuggers from './widgets/debuggers';
import drawErrorMessages from './widgets/errorMessages';
import drawInfoPanels from './widgets/infoPanels';
import drawMeters from './widgets/meters';
import drawPlotters from './widgets/plotters';

const corner = '+';

export default function drawModules(
	engine: DrawContext,
	state: State,
	memoryViews: MemoryViews,
	renderData: WebUiRenderData,
	drawers?: CodeBlockDrawerRegistry
): void {
	const spriteLookups = state.spriteLookups;

	if (!spriteLookups) {
		return;
	}

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
				engine.drawSprite(0, 0, spriteLookups.fillColors.moduleBackgroundDragged, codeBlock.width, codeBlock.height);
			} else if (codeBlock.disabled) {
				engine.drawSprite(0, 0, spriteLookups.fillColors.moduleBackgroundDisabled, codeBlock.width, codeBlock.height);
			} else {
				engine.drawSprite(0, 0, spriteLookups.fillColors.moduleBackground, codeBlock.width, codeBlock.height);
			}

			drawBlockHighlights(engine, state, codeBlock);

			if (state.featureFlags.codeLineSelection && state.codeBlockRendering.selectedCodeBlock === codeBlock) {
				engine.drawSprite(
					0,
					codeBlock.cursor.y,
					spriteLookups.fillColors.highlightedCodeLine,
					codeBlock.width,
					state.viewport.hGrid
				);
			}

			const cornerFont =
				state.codeBlockRendering.selectedCodeBlock === codeBlock ? spriteLookups.fontNumbers : spriteLookups.fontCode;

			engine.drawText(0, 0, corner, cornerFont);
			engine.drawText(codeBlock.width - state.viewport.vGrid, 0, corner, cornerFont);
			engine.drawText(0, codeBlock.height - state.viewport.hGrid, corner, cornerFont);
			engine.drawText(
				codeBlock.width - state.viewport.vGrid,
				codeBlock.height - state.viewport.hGrid,
				corner,
				cornerFont
			);

			for (let i = 0; i < codeCells.length; i++) {
				engine.drawResolvedText(state.viewport.vGrid, state.viewport.hGrid * i, codeCells[i]);
			}

			drawShapeDeclarations(engine, state, codeBlock);

			if (state.featureFlags.editing && state.codeBlockRendering.selectedCodeBlock === codeBlock) {
				engine.drawText(
					codeBlock.cursor.x,
					codeBlock.cursor.y,
					'_',
					codeBlock.disabled ? spriteLookups.fontDisabledCode : spriteLookups.fontCode
				);
			}
			drawAssertions(engine, state, codeBlock);

			if (state.codeBlockRendering.selectedCodeBlock === codeBlock) {
				drawSelectedOutline(engine, state, codeBlock.width, codeBlock.height);
			}

			drawErrorMessages(engine, state, codeBlock);
			drawers?.drawCodeBlock({ draw: engine, state, codeBlock, memoryViews });
			drawCrossfades(engine, state, codeBlock, memoryViews);
			drawConnectors(engine, state, codeBlock, memoryViews);
			drawBars(engine, state, codeBlock, memoryViews);
			drawMeters(engine, state, codeBlock, memoryViews);
			drawPlotters(engine, state, codeBlock, memoryViews);
			drawInfoPanels(engine, state, codeBlock);
			drawDebuggers(engine, state, codeBlock, memoryViews);
			drawers?.drawCodeBlockOverlay({ draw: engine, state, codeBlock, memoryViews });

			engine.endGroup();
		} else if (state.featureFlags.offscreenBlockArrows) {
			// Module is off-screen, draw arrow indicators
			drawArrow(engine, codeBlock, state);
		}
	}

	engine.endGroup();
}
