import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';

const COLUMN_INTERVAL = 100;
const ROW_INTERVAL = 50;
const DOT_RADIUS = 1;
const DOT_SIZE = 2 * DOT_RADIUS + 1;
const LABEL_OFFSET_X = 5;
const LABEL_OFFSET_Y = 2;

/** World-anchored reference marks every 100 columns and 50 rows of the editor grid. */
export const coordinateGridPlugin: EditorPlugin = {
	id: 'coordinate-grid',
	setup: ({ drawers }) =>
		drawers.registerCanvasBackgroundDrawer(({ draw, viewport }) => {
			const { x, y, width, height, vGrid, hGrid } = viewport;
			if (width <= 0 || height <= 0 || vGrid <= 0 || hGrid <= 0) return;

			const strideX = COLUMN_INTERVAL * vGrid;
			const strideY = ROW_INTERVAL * hGrid;
			// A label whose dot just left the top or left edge can still be visible.
			const firstColumn = Math.floor(x / strideX);
			const lastColumn = Math.floor((x + width - 1 + DOT_RADIUS) / strideX);
			const firstRow = Math.floor(y / strideY);
			const lastRow = Math.floor((y + height - 1 + DOT_RADIUS) / strideY);

			for (let row = firstRow; row <= lastRow; row++) {
				const screenY = row * strideY - y;
				const dotY = screenY - DOT_RADIUS;
				const labelY = screenY + LABEL_OFFSET_Y;
				for (let column = firstColumn; column <= lastColumn; column++) {
					const screenX = column * strideX - x;
					const dotX = screenX - DOT_RADIUS;
					if (dotX + DOT_SIZE > 0 && dotX < width && dotY + DOT_SIZE > 0 && dotY < height) {
						draw.drawFill(dotX, dotY, PALETTE_INDICES.mutedBase, DOT_SIZE, DOT_SIZE);
					}

					const labelX = screenX + LABEL_OFFSET_X;
					if (labelX >= width || labelY + hGrid <= 0 || labelY >= height) continue;
					const label = `${column * COLUMN_INTERVAL}, ${row * ROW_INTERVAL}`;
					if (labelX + label.length * vGrid > 0) {
						draw.drawNumericText(labelX, labelY, label, PALETTE_INDICES.mutedSoft);
					}
				}
			}
		}),
};
