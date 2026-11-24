import initView, { createEditorRenderRegistry } from '@8f4e/web-ui';
import { Engine } from 'glugglugglug';
import { expect, test } from 'vitest';
import { setup } from '../src/__tests__/setup';
import { barsPlugin } from '../src/index';

test('bars plugin renders its directive', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 512;
	canvas.style.background = '#000';
	document.body.append(canvas);
	const renderRegistry = createEditorRenderRegistry();
	const test = await setup(
		barsPlugin,
		[
			'module audio',
			'; @pos 4 3',
			'float[] samples 64',
			'float[] points 8 0 0.25 0.5 0.75 1 0.75 0.5 0.25',
			'; @bars &samples count(samples) 0 1',
			'; @bars &points count(points) 0 1',
			'moduleEnd',
		],
		{ renderRegistry }
	);
	test.state.viewport.width = canvas.width;
	test.state.viewport.height = canvas.height;
	const memory = test.compiled.memoryPlan.modules.audio.memory.samples;
	for (let index = 0; index < 64; index++)
		test.memoryViews.float32[memory.allocationUnitAddress + index] = (Math.sin((index * Math.PI) / 16) + 1) / 2;

	const renderer = await initView(test.store, test.events, new Engine(canvas), test.memoryViews, {
		loading: test.store.loading,
		renderRegistry,
	});

	try {
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
		canvas.remove();
	}
});
