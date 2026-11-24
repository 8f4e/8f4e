import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { describe, expect, it, vi } from 'vitest';
import { exposedSource } from './__tests__/exposed-source';
import { setup } from './__tests__/setup';
import { plotPlugin } from './index';

const source = ['module audio', 'int8[] samples 4 0 1 2 3', '; @plot &samples count(samples) 0 3', 'moduleEnd'];
describe('plot plugin', () => {
	it('draws a fixed-reference buffer using its backing element count', async () => {
		const test = await setup(plotPlugin, [
			'module audio',
			'float[] samples 3 -1 0 1',
			'float& buffer &samples',
			'; @plot buffer count(buffer)',
			'moduleEnd',
		]);
		test.render();
		const points = vi.mocked(test.draw.drawFill).mock.calls.filter(call => call[2] === PALETTE_INDICES.onDarkAccent);
		expect(points).toHaveLength(3);
		expect(points[0][1]).toBeGreaterThan(points[2][1]);
	});
	it.each(['int8', 'int8u', 'int16', 'int16u', 'int', 'float', 'float64'])(
		'lays out and draws %s arrays',
		async type => {
			const test = await setup(plotPlugin, [
				'module audio',
				`${type}[] samples 4 0 1 2 3`,
				'; @plot &samples count(samples) 0 3',
				'moduleEnd',
			]);
			test.render();
			expect(test.block.gaps.get(2)?.size).toBe(8);
			expect(test.draw.drawFill).toHaveBeenCalledWith(
				0,
				0,
				PALETTE_INDICES.darkSurface,
				expect.any(Number),
				test.state.viewport.hGrid * 8
			);
			expect(vi.mocked(test.draw.drawFill).mock.calls.length).toBeGreaterThan(1);
		}
	);
	it.each(['pointer', '*address'])('reads %s and a runtime length on each frame', async source => {
		const test = await setup(plotPlugin, [
			'module audio',
			'int8[] samples 4 0 1 2 3',
			'int8* pointer &samples',
			'int8** address &pointer',
			'int length 4',
			`; @plot ${source} length 0 3`,
			'moduleEnd',
		]);
		const lengthAddress = test.compiled.memoryPlan.modules.audio.memory.length.allocationUnitAddress;
		for (const length of [4, 0, 1]) {
			test.memoryViews.int32[lengthAddress] = length;
			test.render();
			const points = vi.mocked(test.draw.drawFill).mock.calls.filter(call => call[2] === PALETTE_INDICES.onDarkAccent);
			expect(points).toHaveLength(length);
		}
	});
	it('resolves arrays exposed by a project group', async () => {
		const test = await setup(plotPlugin, exposedSource);
		test.render();
		expect(vi.mocked(test.draw.drawFill).mock.calls.length).toBeGreaterThan(1);
	});
	it('rebinds relocated samples without recalculating block layout', async () => {
		const test = await setup(plotPlugin, source);
		const layoutChanged = vi.fn();
		test.events.on('codeBlockLayoutsChanged', layoutChanged);
		const replacement = await compileProject(
			parseProjectSource(['8f4e/v1', 'entry main', ...source, 'entryEnd'].join('\n')),
			{
				cache: test.compiled.cache,
				startingMemoryAllocationUnitAddress: 16,
			}
		);
		const samples = replacement.memoryPlan.modules.audio.memory.samples;
		expect(samples.byteAddress).not.toBe(test.compiled.memoryPlan.modules.audio.memory.samples.byteAddress);
		test.memoryViews.int8.fill(3, samples.byteAddress, samples.byteAddress + 4);
		test.store.set('compiler.result', { ...replacement, inputRevision: test.state.compilerInputRevision });
		test.render();
		const points = vi.mocked(test.draw.drawFill).mock.calls.filter(call => call[2] === PALETTE_INDICES.onDarkAccent);
		expect(points.map(call => call[1])).toEqual([0, 0, 0, 0]);
		expect(layoutChanged).not.toHaveBeenCalled();
	});
	it('removes stale data after source changes and restores it when memory becomes available', async () => {
		const test = await setup(plotPlugin, source);
		test.render();
		expect(test.draw.drawFill).toHaveBeenCalled();
		test.update(['module audio', '; @plot &missing 4', 'moduleEnd']);
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		test.update(source);
		test.render();
		expect(test.draw.drawFill).toHaveBeenCalled();
	});
	it('is optional, releases layout and drawing, and keeps editors independent', async () => {
		const omitted = await setup(plotPlugin, source, { installed: false });
		omitted.render();
		expect(omitted.block.gaps.size).toBe(0);
		expect(omitted.draw.drawFill).not.toHaveBeenCalled();
		const first = await setup(plotPlugin, source);
		const second = await setup(plotPlugin, source);
		first.dispose();
		first.update(source);
		first.render();
		second.render();
		expect(first.block.gaps.size).toBe(0);
		expect(first.draw.drawFill).not.toHaveBeenCalled();
		expect(second.draw.drawFill).toHaveBeenCalled();
	});
});
