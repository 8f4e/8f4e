import initEditor from '@8f4e/editor-core';
import { expect, test } from 'vitest';
import { dialogsPlugin } from '../src/index';

test.each([
	{ width: 640, height: 384, name: 'desktop' },
	{ width: 320, height: 640, name: 'portrait' },
])('renders a $name dialog opened before plugin installation', async ({ width, height, name }) => {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	document.body.append(canvas);
	const editor = await initEditor(canvas, {
		featureFlags: { canvasOverlays: false },
		plugins: [
			{
				id: 'dialog-fixture',
				setup: ({ events }) => {
					events.dispatch('addDialog', {
						id: 'permission',
						title: 'Audio playback permission and device settings',
						text: 'Audio playback requires permission. Tap Allow to start sound on this device.',
						buttons: [{ title: 'Cancel' }, { title: 'More information' }, { title: 'Allow audio' }],
					});
					return () => {};
				},
			},
			dialogsPlugin,
		],
	});
	try {
		editor.pauseRendering();
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot(`dialog-${name}`);
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
