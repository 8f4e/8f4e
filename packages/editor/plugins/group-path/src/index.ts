import type { EditorPlugin } from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { type GlyphIds, textToGlyphIds } from '@8f4e/web-ui';

const BRANCH = textToGlyphIds('└─ ');

/** Draw the current project group's ancestry at the top left of the viewport. */
export function createGroupPathPlugin({ topRow = 0 }: { topRow?: number } = {}): EditorPlugin {
	return {
		id: 'group-path',
		setup: ({ store, drawers }) => {
			const state = store.getState();
			let path = '';
			let rows: GlyphIds[] = [];
			let columns = 0;
			const refresh = () => {
				const currentPath = state.project.activeLevel.path;
				if (currentPath === path) return;
				path = currentPath;
				rows = path
					? path.split('/').map(segment => [...BRANCH, ...textToGlyphIds(`group ${decodeURIComponent(segment)}`)])
					: [];
				columns = rows.reduce((width, row, depth) => Math.max(width, depth * BRANCH.length + row.length + 2), 0);
			};
			store.subscribe('project.activeLevel.path', refresh);
			// Renaming a group can update paths in place.
			store.subscribe('projectChange', refresh);
			refresh();

			const removeDrawer = drawers.registerCanvasOverlay(({ draw }) => {
				if (!rows.length) return;
				const { vGrid, hGrid } = state.viewport;
				draw.startGroup(0, topRow * hGrid);
				draw.drawFill(0, 0, PALETTE_INDICES.surfaceBase, columns * vGrid, rows.length * hGrid);
				for (const [depth, row] of rows.entries()) {
					draw.drawGlyphs(
						(1 + depth * BRANCH.length) * vGrid,
						depth * hGrid,
						row,
						depth === rows.length - 1 ? PALETTE_INDICES.inkBase : PALETTE_INDICES.mutedBase
					);
				}
				draw.endGroup();
			});
			return () => {
				store.unsubscribe('project.activeLevel.path', refresh);
				store.unsubscribe('projectChange', refresh);
				removeDrawer();
			};
		},
	};
}
