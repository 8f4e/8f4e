import initView, { createEditorRenderRegistry } from '@8f4e/web-ui';
import { AsciiRenderer } from '@8f4e/web-ui-testing';
import { expect, test } from 'vitest';
import { createStackPlugin } from '../index';
import { setup } from './setup';

test('stack plugin renders its directive', async () => {
	const width = 768;
	const height = 512;
	const ascii = new AsciiRenderer(width, height);
	const renderRegistry = createEditorRenderRegistry();
	const test = await setup(
		createStackPlugin({ prefersReducedMotion: () => true }),
		['module audio', '; @pos 4 3', 'push 2 ; @stack', 'push 3', '; @stack', 'add ; @s', 'drop ; @stack', 'moduleEnd'],
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
		await expect(`${ascii.toText()}\n`).toMatchFileSnapshot('./__snapshots__/stack-values.viewport.snap');
	} finally {
		renderer.destroy();
	}
});
