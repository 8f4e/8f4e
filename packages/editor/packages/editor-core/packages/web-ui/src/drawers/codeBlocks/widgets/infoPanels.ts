import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { formatInfoValue, isRenderableInfoValue } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, InfoRecord, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../../drawContext';

function truncateToCells(value: string, maxCells: number): string {
	if (maxCells <= 0) {
		return '';
	}

	if (value.length <= maxCells) {
		return value;
	}

	if (maxCells === 1) {
		return '~';
	}

	return value.slice(0, maxCells - 1) + '~';
}

function hasInfoRecord(info: InfoRecord | undefined): info is InfoRecord {
	if (!info || typeof info !== 'object' || Array.isArray(info)) {
		return false;
	}

	return true;
}

export default function drawInfoPanels(engine: DrawContext, state: State, codeBlock: CodeBlockGraphicData): void {
	for (const panel of codeBlock.widgets.infoPanels) {
		const info = state.info[panel.id];

		if (!hasInfoRecord(info)) {
			continue;
		}

		const valueColumn = panel.keyColumnWidth + 2;
		const panelCells = Math.max(0, Math.floor(panel.width / state.viewport.vGrid));
		let renderedRows = 0;

		engine.startGroup(panel.x, panel.y);
		engine.drawFill(0, 0, PALETTE_INDICES.surfaceBase, panel.width, panel.height);

		for (const key in info) {
			const value = info[key];

			if (!Object.hasOwn(info, key) || !isRenderableInfoValue(value)) {
				continue;
			}

			const y = renderedRows * state.viewport.hGrid;
			const truncatedKey = truncateToCells(key, panel.keyColumnWidth);
			const truncatedValue = truncateToCells(formatInfoValue(value), panelCells - valueColumn);

			engine.drawText(0, y, truncatedKey, PALETTE_INDICES.primaryBase);
			engine.drawText(panel.keyColumnWidth * state.viewport.vGrid, y, ':', PALETTE_INDICES.primaryBase);
			engine.drawText(valueColumn * state.viewport.vGrid, y, truncatedValue, PALETTE_INDICES.secondaryBase);
			renderedRows += 1;

			if (renderedRows >= panel.rowCount) {
				break;
			}
		}

		engine.endGroup();
	}
}
