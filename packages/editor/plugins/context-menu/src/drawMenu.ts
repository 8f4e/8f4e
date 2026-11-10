import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { ContextMenuItem } from '@8f4e/editor-state-types';
import type { DrawContext } from '@8f4e/web-ui';
import type layoutMenu from './layoutMenu';

export default function drawMenu(
	draw: DrawContext,
	items: ContextMenuItem[],
	layout: ReturnType<typeof layoutMenu>,
	highlighted: number
) {
	draw.startGroup(layout.x, layout.y);
	for (let index = 0; index < items.length; index++) {
		const item = items[index];
		const selected = index === highlighted && !item.disabled && !item.divider;
		draw.startGroup(0, index * layout.rowHeight);
		draw.drawFill(
			0,
			0,
			selected ? PALETTE_INDICES.selectionSurface : PALETTE_INDICES.floatingSurface,
			layout.width,
			layout.rowHeight
		);
		if (!item.divider)
			draw.drawGlyphs(
				0,
				0,
				layout.labels[index],
				selected
					? PALETTE_INDICES.selectionInk
					: item.disabled
						? PALETTE_INDICES.floatingMuted
						: PALETTE_INDICES.floatingInk
			);
		draw.endGroup();
	}
	draw.endGroup();
}
