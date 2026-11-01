import { describe, expect, it, vi } from 'vitest';
import { setup } from './__tests__/setup';
import { createStackPlugin } from './index';

const plugin = createStackPlugin({ prefersReducedMotion: () => true });
const source = ['module audio', 'push 2', 'push 3', '; @stack', 'drop', 'drop', 'moduleEnd'];
describe('stack plugin', () => {
	it('shows the stack after the preceding instruction for standalone directives', async () => {
		const test = await setup(plugin, source);
		test.render();
		expect(test.draw.drawText).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), '2, 3', expect.any(Number));
	});
	it.each(['stack', 's'])('uses the same instruction for inline @%s', async directive => {
		const test = await setup(plugin, ['module audio', `push 3 ; @${directive}`, 'drop', 'moduleEnd']);
		test.render();
		expect(test.draw.drawText).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), '3', expect.any(Number));
	});
	it('draws an empty stack and ignores unsupported arguments', async () => {
		const test = await setup(plugin, ['module audio', 'push 1', 'drop ; @stack', '; @stack extra', 'moduleEnd']);
		test.render();
		expect(test.draw.drawText).toHaveBeenCalledOnce();
		expect(test.draw.drawText).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), '', expect.any(Number));
	});
	it('reads analysis for function blocks', async () => {
		const test = await setup(
			plugin,
			[
				'8f4e/v1',
				'function helper',
				'push 3 ; @stack',
				'drop',
				'functionEnd',
				'entry main',
				'module audio',
				'call helper',
				'moduleEnd',
				'entryEnd',
			],
			{ name: 'helper' }
		);
		test.render();
		expect(test.draw.drawText).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), '3', expect.any(Number));
	});
	it('rebuilds after compiler results change and removes missing analysis', async () => {
		const test = await setup(plugin, source);
		test.render();
		expect(test.draw.drawText).toHaveBeenCalled();
		test.store.set('compiler.result.compiledModules', {});
		test.store.set('compiler.isCompiling', false);
		test.render();
		expect(test.draw.drawText).not.toHaveBeenCalled();
	});
	it('honors the host motion preference', async () => {
		vi.spyOn(performance, 'now').mockReturnValue(1100);
		const test = await setup(createStackPlugin({ prefersReducedMotion: () => false }), source);
		test.render();
		expect(vi.mocked(test.draw.drawCharacter).mock.calls[0][4]).toBeGreaterThan(test.state.viewport.vGrid);
	});
	it('is optional, releases its contributions, and isolates editors', async () => {
		const omitted = await setup(plugin, source, { installed: false });
		omitted.render();
		expect(omitted.draw.drawText).not.toHaveBeenCalled();
		const first = await setup(plugin, source);
		const second = await setup(plugin, source);
		first.dispose();
		first.render();
		second.render();
		expect(first.draw.drawText).not.toHaveBeenCalled();
		expect(second.draw.drawText).toHaveBeenCalled();
	});
});
