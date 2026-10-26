import type { CodeBlockGraphicData, InfoRecord, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../../../drawContext';

function isRenderableInfoValue(value: unknown): value is string | number | boolean {
	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function formatInfoValue(value: string | number | boolean): string {
	if (typeof value === 'string') {
		return value;
	}

	if (typeof value === 'boolean') {
		return String(value);
	}

	if (!Number.isFinite(value) || Number.isInteger(value)) {
		return String(value);
	}

	const roundedValue = Math.round(value * 10000) / 10000;
	return String(Object.is(roundedValue, -0) ? 0 : roundedValue);
}

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
	const spriteLookups = state.spriteLookups;

	if (!spriteLookups) {
		return;
	}

	for (const panel of codeBlock.widgets.infoPanels) {
		const info = state.info[panel.id];

		if (!hasInfoRecord(info)) {
			continue;
		}

		const valueColumn = panel.keyColumnWidth + 2;
		const panelCells = Math.max(0, Math.floor(panel.width / state.viewport.vGrid));
		let renderedRows = 0;

		engine.startGroup(panel.x, panel.y);
		engine.drawSprite(0, 0, spriteLookups.fillColors.surfaceBase, panel.width, panel.height);

		for (const key in info) {
			const value = info[key];

			if (!Object.hasOwn(info, key) || !isRenderableInfoValue(value)) {
				continue;
			}

			const y = renderedRows * state.viewport.hGrid;
			const truncatedKey = truncateToCells(key, panel.keyColumnWidth);
			const truncatedValue = truncateToCells(formatInfoValue(value), panelCells - valueColumn);

			engine.drawText(0, y, truncatedKey, spriteLookups.fontPrimaryBase);
			engine.drawText(panel.keyColumnWidth * state.viewport.vGrid, y, ':', spriteLookups.fontPrimaryBase);
			engine.drawText(valueColumn * state.viewport.vGrid, y, truncatedValue, spriteLookups.fontSecondaryBase);
			renderedRows += 1;

			if (renderedRows >= panel.rowCount) {
				break;
			}
		}

		engine.endGroup();
	}
}
