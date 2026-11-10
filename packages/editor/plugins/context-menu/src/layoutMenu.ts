import type { ContextMenu, Viewport } from '@8f4e/editor-state-types';
import { textToGlyphIds } from '@8f4e/web-ui';

export default function layoutMenu(menu: ContextMenu, viewport: Viewport) {
	const labels = menu.items.map(item => (item.divider ? '' : (item.title ?? '') + (item.close === false ? ' >' : '')));
	const longest = Math.max(16, ...labels.map(label => label.length));
	const width = (longest + 3) * viewport.vGrid;
	const height = menu.items.length * viewport.hGrid;
	return {
		x: Math.min(
			Math.max(Math.round(menu.x / viewport.vGrid) * viewport.vGrid - viewport.x, 0),
			Math.max(viewport.width - width, 0)
		),
		y: Math.min(
			Math.max(Math.round(menu.y / viewport.hGrid) * viewport.hGrid - viewport.y, 0),
			Math.max(viewport.height - height, 0)
		),
		width,
		height,
		rowHeight: viewport.hGrid,
		labels: labels.map((label, index) => {
			const padding = '.'.repeat(longest + 2 - label.length);
			return textToGlyphIds(menu.items[index].isSectionTitle ? label + ' ' + padding : padding + ' ' + label);
		}),
	};
}
