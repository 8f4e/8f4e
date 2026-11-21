import type { LineColor, LineDrawer } from './line-drawer';

const SAG_PER_HORIZONTAL_PIXEL = 0.25;
const MAX_SAG_PIXELS = 96;

/** Draw a gravity-like sag between the rendered connector positions. */
export function drawLooseWire(
	lines: Pick<LineDrawer, 'drawLine'>,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	thickness: number,
	color: LineColor
): void {
	const dx = x2 - x1;
	const sag = Math.min(MAX_SAG_PIXELS, Math.abs(dx) * SAG_PER_HORIZONTAL_PIXEL);
	if (sag < 0.5) {
		lines.drawLine(x1, y1, x2, y2, thickness, color);
		return;
	}

	const dy = y2 - y1;
	// An even segment count samples the midpoint and keeps chord error under half a pixel.
	const segments = 2 * Math.ceil(Math.sqrt(sag / 2));
	let previousX = x1;
	let previousY = y1;
	for (let i = 1; i < segments; i++) {
		const t = i / segments;
		const x = x1 + t * dx;
		const y = y1 + t * dy + 4 * sag * t * (1 - t);
		lines.drawLine(previousX, previousY, x, y, thickness, color, i > 1);
		previousX = x;
		previousY = y;
	}
	lines.drawLine(previousX, previousY, x2, y2, thickness, color, true);
}
