import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../drawContext';

export default function drawContextMenu(engine: DrawContext, state: State): void {
	const { open, items, x, y, highlightedItem, itemWidth } = state.contextMenu;

	if (!open) {
		return;
	}

	engine.startGroup(x - state.viewport.x, y - state.viewport.y);
	for (let i = 0; i < items.length; i++) {
		engine.startGroup(0, i * state.viewport.hGrid);
		let color = PALETTE_INDICES.floatingInk;
		if (i === highlightedItem && !items[i].disabled && !items[i].divider) {
			engine.drawFill(0, 0, PALETTE_INDICES.selectionSurface, itemWidth, state.viewport.hGrid);
			color = PALETTE_INDICES.selectionInk;
		} else {
			engine.drawFill(0, 0, PALETTE_INDICES.floatingSurface, itemWidth, state.viewport.hGrid);
			color = items[i].disabled ? PALETTE_INDICES.floatingMuted : PALETTE_INDICES.floatingInk;
		}
		if (!items[i].divider) {
			engine.drawText(0, 0, items[i].title || '', color);
		}
		engine.endGroup();
	}
	engine.endGroup();
}
