import { getTabStopsByLine, getVisualLineWidth } from '@8f4e/editor-state';
import { describe, expect, it, vi } from 'vitest';
import { exposedSource } from './__tests__/exposed-source';
import { setup } from './__tests__/setup';
import { createWatchPlugin } from './index';

const plugin = createWatchPlugin({ prefersReducedMotion: () => true });
const source = ['module audio', 'int value 7 ; @watch', 'moduleEnd'];
describe('watch plugin', () => {
	it.each(['watch', 'w'])('resolves @%s and infers anonymous inline declarations', async directive => {
		const test = await setup(plugin, ['module audio', `int 7 ; @${directive}`, 'moduleEnd']);
		test.render();
		expect(test.draw.drawText).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), '7', expect.any(Number));
	});
	it.each([
		['0x', '00 00 00 07'],
		['0b', '111'],
	])('formats inferred values with %s', async (format, expected) => {
		const test = await setup(plugin, ['module audio', `int value 7 ; @watch ${format}`, 'moduleEnd']);
		test.render();
		expect(test.draw.drawText).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			expected,
			expect.any(Number)
		);
	});
	it('reads typed indexed values and address expressions', async () => {
		const test = await setup(plugin, [
			'module audio',
			'int8[] buffer 4 1 2 3 4',
			'; @watch buffer[2]',
			'; @watch &buffer[2]',
			'; @watch buffer&',
			'moduleEnd',
		]);
		test.render();
		const memory = test.compiled.memoryPlan.modules.audio.memory.buffer;
		expect(test.draw.drawText).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), '3', expect.any(Number));
		expect(test.draw.drawText).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			String(memory.byteAddress + 2),
			expect.any(Number)
		);
		expect(test.draw.drawText).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			String(memory.endByteAddress),
			expect.any(Number)
		);
	});
	it('places the value after the visual width of a tabbed source line', async () => {
		const code = ['module audio', '; @tab 8 16', 'int\tvalue\t7 ; @watch', 'moduleEnd'];
		const test = await setup(plugin, code);
		test.render();
		const width = getVisualLineWidth(code[2], getTabStopsByLine(code)[2]);
		expect(test.draw.drawText).toHaveBeenCalledWith(
			test.state.viewport.vGrid * (4 + test.block.lineNumberColumnWidth + width),
			expect.any(Number),
			'7',
			expect.any(Number)
		);
	});
	it('resolves exposed memory and drops stale values after a metadata replacement', async () => {
		const test = await setup(plugin, exposedSource);
		test.render();
		expect(test.draw.drawText).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			'0.2500',
			expect.any(Number)
		);
		test.store.set('compiler.projectMemoryExposuresByGroupPath', {});
		test.events.dispatch('runtimeInitialized');
		test.render();
		expect(test.draw.drawText).not.toHaveBeenCalled();
	});
	it('honors a changing host motion preference', async () => {
		let reduced = false;
		vi.spyOn(performance, 'now').mockReturnValue(1100);
		const test = await setup(createWatchPlugin({ prefersReducedMotion: () => reduced }), source);
		test.render();
		expect(vi.mocked(test.draw.drawCharacter).mock.calls[0][4]).toBeGreaterThan(test.state.viewport.vGrid);
		reduced = true;
		test.render();
		expect(vi.mocked(test.draw.drawCharacter).mock.calls[0][4]).toBe(test.state.viewport.vGrid);
	});
	it('is optional, removes stale references, disposes drawing, and isolates editors', async () => {
		const omitted = await setup(plugin, source, { installed: false });
		omitted.render();
		expect(omitted.draw.drawText).not.toHaveBeenCalled();
		const first = await setup(plugin, source);
		const second = await setup(plugin, source);
		first.update(['module audio', '; @watch missing', 'moduleEnd']);
		first.render();
		expect(first.draw.drawText).not.toHaveBeenCalled();
		first.update(source);
		first.render();
		expect(first.draw.drawText).toHaveBeenCalled();
		first.dispose();
		first.render();
		second.render();
		expect(first.draw.drawText).not.toHaveBeenCalled();
		expect(second.draw.drawText).toHaveBeenCalled();
	});
});
