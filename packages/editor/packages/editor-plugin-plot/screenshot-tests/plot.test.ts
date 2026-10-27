import { resolvePalette } from '@8f4e/editor-palette';
import loadFontAtlas from '@8f4e/sprite-generator';
import initView, { createCodeBlockDrawerRegistry } from '@8f4e/web-ui';
import { createWebUiRenderProjection } from '@8f4e/web-ui-render-projection';
import { expect, test } from 'vitest';
import { setup } from '../src/__tests__/setup';
import { plotPlugin } from '../src/index';

test('plot plugin renders its directive', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 512;
	canvas.style.background = '#000';
	document.body.append(canvas);
	const drawers = createCodeBlockDrawerRegistry();
	const test = await setup(
		plotPlugin,
		[
			'module audio',
			'; @pos 4 3',
			'float[] samples 64',
			'float[] points 8 -1 -0.5 0 0.5 1 0.5 0 -0.5',
			'; @plot &samples count(samples) -1 1',
			'; @plot &points count(points) -1 1',
			'moduleEnd',
		],
		{ drawers }
	);
	test.state.viewport.width = canvas.width;
	test.state.viewport.height = canvas.height;
	const memory = test.compiled.memoryPlan.modules.audio.memory.samples;
	for (let index = 0; index < 64; index++)
		test.memoryViews.float32[memory.allocationUnitAddress + index] = Math.sin((index * Math.PI) / 16);

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
