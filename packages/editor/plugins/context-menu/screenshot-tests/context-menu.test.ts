import initEditor from '@8f4e/editor-core';
import type { EventDispatcher } from '@8f4e/editor-state-types';
import { expect, test, vi } from 'vitest';
import { contextMenuPlugin } from '../src/index';

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
					return context.menus.registerMenu('mainMenu', () => [
						{ title: 'Actions', isSectionTitle: true },
						{ title: 'Choose', action: 'choose', close: true },
						{ title: 'More actions', close: false },
						{ divider: true },
						{ title: 'Unavailable', disabled: true },
					]);
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
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
