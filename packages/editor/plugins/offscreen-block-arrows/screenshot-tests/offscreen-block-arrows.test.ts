import initEditor from '@8f4e/editor-core';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import { offscreenBlockArrowsPlugin } from '../src/index';

test.each(['origin', 'panned', 'fallback'])('draws offscreen arrows at raw viewport edges: %s', async position => {
	const canvas = document.createElement('canvas');
	canvas.width = 641;
	canvas.height = 383;
	document.body.append(canvas);
	const editor = await initEditor(canvas, {
		renderer: new Engine(canvas),
		defaultFont: position === 'fallback' ? 'spleen6x12' : undefined,
		initialProject: {
			...EMPTY_DEFAULT_PROJECT,
			constants: [{ id: 0, code: ['constants visible', '; @pos 0 0', 'constantsEnd'] }],
			execution: [
				[40, -10],
				[120, 12],
				[40, 40],
				[-80, 12],
				[120, -20],
			].map(([x, y], id) => ({
				type: 'module',
				id,
				entry: 'main',
				code: [`module block${id}`, `; @pos ${x} ${y}`, 'moduleEnd'],
			})),
		},
		plugins: [offscreenBlockArrowsPlugin],
	});
	editor.pauseRendering();
	try {
		editor.state.viewport.x = position === 'panned' ? 24 : 0;
		editor.state.viewport.y = position === 'panned' ? 32 : 0;
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot(`offscreen-block-arrows-${position}`);
	} finally {
		editor.dispose();
		canvas.remove();
	}
});
