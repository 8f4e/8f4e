import { resolvePalette } from '@8f4e/editor-palette';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import loadFontAtlas from '@8f4e/sprite-generator';
import initView, { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { expect, test } from 'vitest';
import { setup } from '../src/__tests__/setup';
import { createStackPlugin } from '../src/index';

test('stack plugin renders its directive', async () => {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 512;
	canvas.style.background = '#000';
	document.body.append(canvas);
	const drawers = createEditorDrawerRegistry();
	const test = await setup(
		createStackPlugin({ prefersReducedMotion: () => true }),
		['module audio', '; @pos 4 3', 'push 2 ; @stack', 'push 3', '; @stack', 'add ; @s', 'drop ; @stack', 'moduleEnd'],
		{ drawers }
	);
	test.state.viewport.width = canvas.width;
	test.state.viewport.height = canvas.height;
	const spriteData = await loadFontAtlas(test.state.editorConfig.font);
	const disposeCodeRendering = codeRenderingPlugin.setup({
		store: test.store,
		events: test.events,
		menus: test.store.menus,
		directives: test.store.directives,
		layout: test.store.layout,
		drawers,
	});
	const renderer = await initView(
		test.state,
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
		disposeCodeRendering();
		canvas.remove();
	}
});
