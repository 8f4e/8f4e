import initView, { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { expect, test } from 'vitest';
import { setup } from '../src/__tests__/setup';
import { createWatchPlugin } from '../src/index';

test('watch plugin renders its directive', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 512;
	canvas.style.background = '#000';
	document.body.append(canvas);
	const drawers = createEditorDrawerRegistry();
	const test = await setup(
		createWatchPlugin({ prefersReducedMotion: () => true }),
		[
			'module audio',
			'; @pos 4 3',
			'int value 42 ; @watch',
			'; @watch 0bvalue',
			'; @watch 0xvalue',
			'float gain 0.125 ; @watch',
			'int8[] buffer 4 10 20 30 40',
			'; @watch &buffer[2]',
			'; @watch buffer&',
			'moduleEnd',
		],
		{ drawers }
	);
	test.state.viewport.width = canvas.width;
	test.state.viewport.height = canvas.height;

	const renderer = await initView(test.store, test.events, canvas, test.memoryViews, {
		loading: test.store.loading,
		drawers,
	});

	try {
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
		canvas.remove();
	}
});

test('dereferenced watch follows runtime pointer changes without selection', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 256;
	document.body.append(canvas);
	const drawers = createEditorDrawerRegistry();
	const test = await setup(
		createWatchPlugin({ prefersReducedMotion: () => true }),
		[
			'module audio',
			'; @pos 4 3',
			'int first 7',
			'int second 12',
			'int* pointer &first',
			'; @watch *pointer',
			'push &pointer',
			'push &second',
			'store',
			'moduleEnd',
		],
		{ drawers, mode: 'view' }
	);
	test.state.viewport.width = canvas.width;
	test.state.viewport.height = canvas.height;
	const renderer = await initView(test.store, test.events, canvas, test.memoryViews, {
		loading: test.store.loading,
		drawers,
	});
	try {
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot('dereferenced-watch-before-execution');
		test.run();
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot('dereferenced-watch-after-execution');
	} finally {
		renderer.destroy();
		canvas.remove();
	}
});
