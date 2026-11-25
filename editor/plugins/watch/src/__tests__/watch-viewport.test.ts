import initView, { createEditorRenderRegistry } from '@8f4e/web-ui';
import { AsciiRenderer } from '@8f4e/web-ui-testing';
import { expect, test } from 'vitest';
import { createWatchPlugin } from '../index';
import { setup } from './setup';

test('watch plugin renders its directive', async () => {
	const width = 768;
	const height = 512;
	const ascii = new AsciiRenderer(width, height);
	const renderRegistry = createEditorRenderRegistry();
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
			'; @watch end(buffer)',
			'moduleEnd',
		],
		{ renderRegistry }
	);
	test.state.viewport.width = width;
	test.state.viewport.height = height;

	const renderer = await initView(test.store, test.events, ascii, test.memoryViews, {
		loading: test.store.loading,
		renderRegistry,
	});

	try {
		renderer.renderFrame();
		await expect(`${ascii.toText()}\n`).toMatchFileSnapshot('./__snapshots__/watch.viewport.snap');
	} finally {
		renderer.destroy();
	}
});

test('dereferenced watch follows runtime pointer changes without selection', async () => {
	const width = 512;
	const height = 256;
	const ascii = new AsciiRenderer(width, height);
	const renderRegistry = createEditorRenderRegistry();
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
		{ renderRegistry, mode: 'view' }
	);
	test.state.viewport.width = width;
	test.state.viewport.height = height;
	const renderer = await initView(test.store, test.events, ascii, test.memoryViews, {
		loading: test.store.loading,
		renderRegistry,
	});
	try {
		renderer.renderFrame();
		await expect(`${ascii.toText()}\n`).toMatchFileSnapshot(
			'./__snapshots__/dereferenced-watch-before-execution.viewport.snap'
		);
		test.run();
		renderer.renderFrame();
		await expect(`${ascii.toText()}\n`).toMatchFileSnapshot(
			'./__snapshots__/dereferenced-watch-after-execution.viewport.snap'
		);
	} finally {
		renderer.destroy();
	}
});
