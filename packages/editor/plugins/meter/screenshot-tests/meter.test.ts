import { resolvePalette } from '@8f4e/editor-palette';
import loadFontAtlas from '@8f4e/sprite-generator';
import initView, { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { createWebUiRenderProjection } from '@8f4e/web-ui-render-projection';
import { expect, test } from 'vitest';
import { setup } from '../src/__tests__/setup';
import { meterPlugin } from '../src/index';

test('meter plugin renders its directive', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 512;
	canvas.style.background = '#000';
	document.body.append(canvas);
	const drawers = createCodeBlockDrawerRegistry();
	const test = await setup(
		meterPlugin,
		[
			'module audio',
			'; @pos 4 3',
			'float low 0.1',
			'float middle 0.5',
			'float high 0.95',
			'; @meter low 0 1',
			'; @meter middle 0 1',
			'; @meter high 0 1',
			'float bipolar -0.7',
			'; @meter bipolar',
			'moduleEnd',
		],
		{ drawers }
	);
	test.state.viewport.width = canvas.width;
	test.state.viewport.height = canvas.height;
	const spriteData = await loadFontAtlas(test.state.editorConfig.font);
	const projection = createWebUiRenderProjection(test.store, test.events);
	const renderer = await initView(
		test.state,
		projection,
		canvas,
		test.memoryViews,
		spriteData,
		resolvePalette(test.state.editorConfig.color),
		{ drawers }
	);
	renderer.pauseRendering();
	test.events.dispatch('spriteSheetRerendered');
	try {
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
		projection.dispose();
		canvas.remove();
	}
});
