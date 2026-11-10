import initEditor from '@8f4e/editor-core';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { EventDispatcher } from '@8f4e/editor-state-types';
import { textToGlyphIds } from '@8f4e/web-ui';
import { expect, test, vi } from 'vitest';
import { contextMenuPlugin } from '../src/index';

const FLOATING_UI = textToGlyphIds('Floating UI');

test.each([
	{ width: 768, height: 384 },
	{ width: 320, height: 568 },
])('renders and clamps menu content at $width × $height', async ({ width, height }) => {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	document.body.append(canvas);
	let events!: EventDispatcher;
	const editor = await initEditor(canvas, {
		plugins: [
			contextMenuPlugin,
			{
				id: 'fixture-menu',
				setup: context => {
					events = context.events;
					const removeOverlay = context.drawers.registerCanvasOverlay(({ draw }) => {
						draw.drawFill(width - 180, height - 96, PALETTE_INDICES.negativeSurface, 180, 96);
						draw.drawGlyphs(width - 172, height - 80, FLOATING_UI, PALETTE_INDICES.negativeOn);
					});
					const removeMenu = context.menus.registerMenu('mainMenu', () => [
						{ title: 'Actions', isSectionTitle: true },
						{ title: 'Choose', action: 'choose', close: true },
						{ title: 'More actions', close: false },
						{ divider: true },
						{ title: 'Unavailable', disabled: true },
					]);
					return () => {
						removeOverlay();
						removeMenu();
					};
				},
			},
		],
	});
	editor.pauseRendering();
	try {
		events.dispatch('contextmenu', { x: width - 1, y: height - 1 });
		await vi.waitFor(() => expect(editor.state.contextMenu.items).toHaveLength(5));
		editor.state.featureFlags.canvasOverlays = false;
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot(`context-menu-${width}`);
		if (width === 768) {
			editor.state.featureFlags.canvasOverlays = true;
			editor.renderFrame();
			await expect(canvas).toMatchScreenshot('context-menu-above-overlay');
		}
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
