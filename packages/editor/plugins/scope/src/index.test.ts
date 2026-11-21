import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setup } from './__tests__/setup';

const source = ['module audio', 'float level 0', '; @scope level 10 -1 1', 'moduleEnd'];

beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }));

describe('scope plugin', () => {
	it('samples one scalar at the requested rate without relying on rendering', async () => {
		const test = await setup(source);
		const index = test.compiled.memoryPlan.modules.audio.memory.level.byteAddress / 4;
		const height = test.state.viewport.hGrid * 8;
		test.render();
		expect(test.block.gaps.get(2)?.size).toBe(8);
		expect(test.backgrounds()).toHaveLength(1);
		expect(test.traces()).toHaveLength(0);
		const width = test.backgrounds()[0][3]!;
		vi.advanceTimersByTime(99);
		expect(test.getMemory).not.toHaveBeenCalled();

		test.memoryViews.float32[index] = -1;
		vi.advanceTimersByTime(1);
		test.memoryViews.float32[index] = 1;
		test.render();
		expect(test.traces().map(([x, y]) => [x, y])).toEqual([[width - 1, height - 1]]);
		test.render();
		expect(test.traces()).toHaveLength(1);
		expect(test.getMemory).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(100);
		test.memoryViews.float32[index] = 0;
		test.render();
		expect(test.traces().map(([x, y]) => [x, y])).toEqual([
			[width - 2, height - 1],
			[width - 1, 0],
		]);
		expect(test.getMemory).toHaveBeenCalledTimes(2);
	});

	it('retains only the newest samples up to the plot width', async () => {
		const test = await setup(['module audio', 'float level -1', '; @scope level 1000 -1 1', 'moduleEnd']);
		test.render();
		const width = test.backgrounds()[0][3]!;
		vi.advanceTimersByTime(1);
		test.memoryViews.float32[test.compiled.memoryPlan.modules.audio.memory.level.byteAddress / 4] = 1;
		vi.advanceTimersByTime(width + 2);
		test.render();
		const points = test.traces();
		expect(points).toHaveLength(width);
		expect(points.every(([, y]) => y === 0)).toBe(true);
		expect(points[0][0]).toBe(0);
		expect(points.at(-1)![0]).toBe(width - 1);
	});

	it('keeps history and timer cadence across layout refreshes and crops to the resized width', async () => {
		const test = await setup(source);
		vi.advanceTimersByTime(150);
		test.events.dispatch('memoryValuesChanged');
		vi.advanceTimersByTime(50);
		test.render();
		expect(test.traces()).toHaveLength(2);
		expect(test.getMemory).toHaveBeenCalledTimes(2);
		const width = test.backgrounds()[0][3]!;
		vi.advanceTimersByTime(width * 100);
		test.state.viewport.vGrid /= 2;
		test.events.dispatch('gridSizeChanged');
		test.render();
		expect(test.backgrounds()[0][3]).toBe(width / 2);
		expect(test.traces()).toHaveLength(width / 2);
	});

	it('supports independently sampled scopes sharing a source line', async () => {
		const test = await setup([
			'module audio',
			'float left -1',
			'float right 1',
			'; @scope left 10 @scope right 20',
			'moduleEnd',
		]);
		expect(test.block.gaps.get(3)?.size).toBe(16);
		vi.advanceTimersByTime(100);
		test.render();
		expect(test.backgrounds()).toHaveLength(2);
		const groups = vi.mocked(test.draw.startGroup).mock.calls;
		expect(groups[1][1] - groups[0][1]).toBe(test.state.viewport.hGrid * 8);
		expect(test.traces().map(([, y]) => y)).toEqual([test.state.viewport.hGrid * 8 - 1, 0, 0]);
	});

	it('shares a sampling timer across blocks at the same rate, keeping their histories independent', async () => {
		const test = await setup([
			'module audio',
			'float level -1',
			'; @scope level 10',
			'moduleEnd',
			'module other',
			'float level 1',
			'; @scope level 10',
			'moduleEnd',
		]);
		const other = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'other')!;
		const height = test.state.viewport.hGrid * 8;
		vi.advanceTimersByTime(100);
		expect(test.getMemory).toHaveBeenCalledTimes(1);
		test.render();
		expect(test.traces().map(([, y]) => y)).toEqual([height - 1]);
		test.render(other);
		expect(test.traces().map(([, y]) => y)).toEqual([0]);

		// A non-finite sample in one scope must not prevent the other from sampling.
		const address = test.compiled.memoryPlan.modules.audio.memory.level.byteAddress / 4;
		test.memoryViews.float32[address] = Number.NaN;
		vi.advanceTimersByTime(100);
		expect(test.getMemory).toHaveBeenCalledTimes(2);
		test.render();
		expect(test.traces()).toHaveLength(1);
		test.render(other);
		expect(test.traces().map(([, y]) => y)).toEqual([0, 0]);
	});

	it.each([
		'int8[] level 1 127',
		'int8u[] level 1 255',
		'int16[] level 1 32767',
		'int16u[] level 1 65535',
		'int level 2147483647',
		'float level 1',
		'float64 level 1',
	])('uses the typed default display range for %s', async declaration => {
		const test = await setup(['module audio', declaration, '; @scope &level 10', 'moduleEnd']);
		vi.advanceTimersByTime(100);
		test.render();
		expect(test.traces()).toHaveLength(1);
		expect(test.traces()[0][1]).toBe(0);
	});

	it('follows live typed pointers and the current compiler memory instance', async () => {
		const test = await setup([
			'module audio',
			'float first -1',
			'float second 1',
			'float* pointer &first',
			'; @scope pointer 10',
			'moduleEnd',
		]);
		const memory = test.compiled.memoryPlan.modules.audio.memory;
		vi.advanceTimersByTime(100);
		test.memoryViews.int32[memory.pointer.allocationUnitAddress] = memory.second.byteAddress;
		vi.advanceTimersByTime(100);
		const replacement = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
		new Int32Array(replacement.buffer)[memory.pointer.allocationUnitAddress] = memory.second.byteAddress;
		new Float32Array(replacement.buffer)[memory.second.byteAddress / 4] = 0;
		test.replaceMemory(replacement);
		vi.advanceTimersByTime(100);
		test.render();
		const height = test.state.viewport.hGrid * 8;
		expect(test.traces().map(([, y]) => y)).toEqual([height - 1, 0, height - 1 - Math.round((height - 1) / 2)]);
	});

	it('resolves group-exposed values', async () => {
		const test = await setup([
			'8f4e/v1',
			'entry main',
			'group audio',
			'expose level &voice:value',
			'; @scope &level 10',
			'entry main',
			'module voice',
			'float value 1',
			'moduleEnd',
			'entryEnd',
			'groupEnd',
			'entryEnd',
		]);
		vi.advanceTimersByTime(100);
		test.render();
		expect(test.traces()).toHaveLength(1);
		expect(test.traces()[0][1]).toBe(0);
	});

	it('reserves space before compilation, pauses for stale metadata, and resumes after compilation', async () => {
		const test = await setup(source, { compile: false });
		expect(test.block.gaps.get(2)?.size).toBe(8);
		vi.advanceTimersByTime(100);
		expect(test.getMemory).not.toHaveBeenCalled();
		test.acceptCompilation();
		vi.advanceTimersByTime(100);
		expect(test.getMemory).toHaveBeenCalledTimes(1);
		test.store.set('compilerInputRevision', test.state.compilerInputRevision + 1);
		test.store.set('compiler.isCompiling', true);
		vi.advanceTimersByTime(200);
		expect(test.getMemory).toHaveBeenCalledTimes(1);
		test.acceptCompilation();
		vi.advanceTimersByTime(100);
		test.render();
		expect(test.traces()).toHaveLength(2);
	});

	it('skips missing or non-finite samples and releases history on a changed binding', async () => {
		const test = await setup(source);
		const index = test.compiled.memoryPlan.modules.audio.memory.level.byteAddress / 4;
		test.memoryViews.float32[index] = Number.NaN;
		vi.advanceTimersByTime(100);
		test.render();
		expect(test.traces()).toHaveLength(0);
		test.memoryViews.float32[index] = 1;
		vi.advanceTimersByTime(100);
		test.render();
		expect(test.traces()).toHaveLength(1);
		test.update(['module audio', 'float level 0', '; @scope level 20 -1 1', 'moduleEnd']);
		test.acceptCompilation();
		test.render();
		expect(test.traces()).toHaveLength(0);
		vi.advanceTimersByTime(50);
		test.render();
		expect(test.traces()).toHaveLength(1);
		test.update(['module audio', 'float level 0', '; @scope missing 10', 'moduleEnd']);
		test.acceptCompilation();
		vi.advanceTimersByTime(100);
		test.render();
		expect(test.block.gaps.get(2)?.size).toBe(8);
		expect(test.backgrounds()).toHaveLength(0);
		expect(test.traces()).toHaveLength(0);
	});

	it('stops sampling inactive project levels and restarts when revisiting them', async () => {
		const test = await setup([
			'8f4e/v1',
			'entry main',
			'group audio',
			'entry main',
			'module voice',
			'float value 1',
			'; @scope value 10',
			'moduleEnd',
			'entryEnd',
			'groupEnd',
			'entryEnd',
		]);
		const voice = test.block.childProject!.blocks.find(block => block.name === 'voice')!;
		vi.advanceTimersByTime(100);
		expect(test.getMemory).not.toHaveBeenCalled();
		test.events.dispatch('openProjectGroup', { codeBlock: test.block });
		vi.advanceTimersByTime(100);
		test.render(voice);
		expect(test.traces()).toHaveLength(1);
		test.events.dispatch('goToRootProjectGroup');
		vi.advanceTimersByTime(100);
		expect(test.getMemory).toHaveBeenCalledTimes(1);
		test.events.dispatch('openProjectGroup', { codeBlock: test.block });
		vi.advanceTimersByTime(100);
		test.render(voice);
		expect(test.traces()).toHaveLength(2);
	});

	it('is optional and cleans up timers and layout independently for each installation', async () => {
		const omitted = await setup(source, { installed: false });
		const first = await setup(source);
		const second = await setup(source);
		vi.advanceTimersByTime(100);
		omitted.render();
		expect(omitted.block.gaps.size).toBe(0);
		expect(omitted.getMemory).not.toHaveBeenCalled();
		first.update(['module audio', 'float level 0', 'moduleEnd']);
		first.acceptCompilation();
		vi.advanceTimersByTime(100);
		expect(first.getMemory).toHaveBeenCalledTimes(1);
		expect(first.block.gaps.size).toBe(0);
		first.update(source);
		first.acceptCompilation();
		vi.advanceTimersByTime(100);
		first.dispose();
		vi.advanceTimersByTime(100);
		first.render();
		second.render();
		expect(first.getMemory).toHaveBeenCalledTimes(2);
		expect(first.block.gaps.size).toBe(0);
		expect(first.backgrounds()).toHaveLength(0);
		expect(second.traces()).toHaveLength(4);
	});
});
