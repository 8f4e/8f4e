import { describe, expect, it, vi } from 'vitest';
import { exposedSource } from './__tests__/exposed-source';
import { setup } from './__tests__/setup';
import { crossfadePlugin } from './index';

const source = ['module audio', 'float dry 0.25', 'float wet 0.75', '; @crossfade &dry &wet', 'moduleEnd'];
describe('crossfade plugin', () => {
	it.each(['view', 'edit'] as const)('drags through pointer events in %s mode without moving the block', async mode => {
		const test = await setup(crossfadePlugin, source, { mode });
		test.render();
		const [localX, localY] = vi.mocked(test.draw.startGroup).mock.calls[0];
		const { x: beforeX, y: beforeY } = test.block;
		const x = test.block.x + localX - test.state.viewport.x;
		const y = test.block.y + localY + 1 - test.state.viewport.y;
		test.events.dispatch('mousedown', { x: x + test.state.viewport.vGrid / 2, y, stopPropagation: false });
		const memory = test.compiled.memoryPlan.modules.audio.memory;
		expect(test.memoryViews.float32[memory.dry.allocationUnitAddress]).toBe(1);
		expect(test.memoryViews.float32[memory.wet.allocationUnitAddress]).toBe(0);
		const drag = { x: x + test.block.width, y, movementX: 20, movementY: 20, stopPropagation: false };
		test.events.dispatch('mousemove', drag);
		expect(drag.stopPropagation).toBe(true);
		expect(test.memoryViews.float32[memory.dry.allocationUnitAddress]).toBe(0);
		expect(test.memoryViews.float32[memory.wet.allocationUnitAddress]).toBe(1);
		expect([test.block.x, test.block.y]).toEqual([beforeX, beforeY]);
		test.events.dispatch('mouseup');
		test.setWordInMemory.mockClear();
		test.events.dispatch('mousemove', { ...drag, stopPropagation: false });
		expect(test.setWordInMemory).not.toHaveBeenCalled();
	});
	it('writes to the backing addresses of exposed project-group memory', async () => {
		const test = await setup(crossfadePlugin, exposedSource);
		test.render();
		const [x, y] = vi.mocked(test.draw.startGroup).mock.calls[0];
		test.events.dispatch('codeBlockPointerDown', {
			codeBlock: test.block,
			x: test.block.x + x + test.state.viewport.vGrid / 2 - test.state.viewport.x,
			y: test.block.y + y + 1 - test.state.viewport.y,
		});
		const memory = test.compiled.memoryPlan.modules['audio/voice'].memory;
		expect(test.memoryViews.float32[memory.level.allocationUnitAddress]).toBe(1);
		expect(test.memoryViews.float32[memory.wet.allocationUnitAddress]).toBe(0);
	});
	it('drops invalid references and rejects unsupported memory types', async () => {
		const test = await setup(crossfadePlugin, source);
		for (const code of [
			['module audio', '; @crossfade &dry &missing', 'moduleEnd'],
			['module audio', '; @crossfade &dry &dry', 'moduleEnd'],
		]) {
			test.update(code);
			test.render();
			if (code[1].includes('missing')) expect(test.draw.drawFill).not.toHaveBeenCalled();
			else expect(test.draw.drawFill).toHaveBeenCalled();
		}
		const integer = await setup(crossfadePlugin, [
			'module audio',
			'int dry 0',
			'float wet 0',
			'; @crossfade &dry &wet',
			'moduleEnd',
		]);
		integer.render();
		expect(integer.draw.drawFill).not.toHaveBeenCalled();
	});
	it('is optional, releases active interactions, and keeps editors independent', async () => {
		const omitted = await setup(crossfadePlugin, source, { installed: false });
		omitted.render();
		expect(omitted.block.gaps.size).toBe(0);
		expect(omitted.draw.drawFill).not.toHaveBeenCalled();
		const first = await setup(crossfadePlugin, source);
		const second = await setup(crossfadePlugin, source);
		first.render();
		const [x, y] = vi.mocked(first.draw.startGroup).mock.calls[0];
		first.events.dispatch('codeBlockPointerDown', {
			codeBlock: first.block,
			x: x - first.state.viewport.x,
			y: y + 1 - first.state.viewport.y,
		});
		first.dispose();
		first.setWordInMemory.mockClear();
		first.events.dispatch('mousemove', { x: 500, y: 50, stopPropagation: false });
		first.update(source);
		first.render();
		second.render();
		expect(first.setWordInMemory).not.toHaveBeenCalled();
		expect(first.block.gaps.size).toBe(0);
		expect(first.draw.drawFill).not.toHaveBeenCalled();
		expect(second.draw.drawFill).toHaveBeenCalled();
	});
});
