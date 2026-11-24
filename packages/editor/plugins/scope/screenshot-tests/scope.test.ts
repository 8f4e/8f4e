import initView, { createEditorRenderRegistry } from '@8f4e/web-ui';
import { Engine } from 'glugglugglug';
import { expect, test, vi } from 'vitest';
import { setup } from '../src/__tests__/setup';

async function expectScopeHistoryScreenshot(sampleCount: number): Promise<void> {
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 512;
	canvas.style.background = '#000';
	document.body.append(canvas);
	const renderRegistry = createEditorRenderRegistry();
	vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
	const test = await setup(['module audio', '; @pos 4 3', 'float signal 0', '; @scope signal 100 -1 1', 'moduleEnd'], {
		renderRegistry,
	});
	test.state.viewport.width = canvas.width;
	test.state.viewport.height = canvas.height;
	const address = test.compiled.memoryPlan.modules.audio.memory.signal.byteAddress / 4;
	for (let index = 0; index < sampleCount; index++) {
		test.memoryViews.float32[address] = Math.sin((index * Math.PI) / 32);
		vi.advanceTimersByTime(10);
	}
	vi.useRealTimers();
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
}

test('scope plugin feeds a partial history from the right', () => expectScopeHistoryScreenshot(64));
test('scope plugin renders circular scalar history', () => expectScopeHistoryScreenshot(256));
