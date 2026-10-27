import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { describe, expect, it, vi } from 'vitest';
import { exposedSource } from './__tests__/exposed-source';
import { setup } from './__tests__/setup';
import { barsPlugin } from './index';

const source = ['module audio', 'int8[] samples 4 0 1 2 3', '; @bars &samples count(samples) 0 3', 'moduleEnd'];
describe('bars plugin', () => {
	it.each(['int8', 'int8u', 'int16', 'int16u', 'int', 'float', 'float64'])(
		'lays out and draws %s arrays',
		async type => {
			const test = await setup(barsPlugin, [
				'module audio',
				`${type}[] samples 4 0 1 2 3`,
				'; @bars &samples count(samples) 0 3',
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
	it('reads an indirect buffer and a runtime length on each frame', async () => {
		const test = await setup(barsPlugin, [
			'module audio',
			'int8[] samples 4 0 1 2 3',
			'int8[] alternate 4 3 2 1 0',
			'int8* pointer &samples',
			'int length 4',
			'; @bars pointer length 0 3',
			'moduleEnd',
		]);
		test.render();
		const before = vi.mocked(test.draw.drawFill).mock.calls.length;
		const { memory } = test.compiled.memoryPlan.modules.audio;
		test.memoryViews.int32[memory.pointer.allocationUnitAddress] = memory.alternate.byteAddress;
		test.memoryViews.int32[memory.length.allocationUnitAddress] = 1;
		test.render();
		expect(vi.mocked(test.draw.drawFill).mock.calls.length).toBeLessThan(before);
		const bars = vi.mocked(test.draw.drawFill).mock.calls.filter(call => call[2] === PALETTE_INDICES.detailBase);
		expect(bars).toEqual([[0, 0, PALETTE_INDICES.detailBase, expect.any(Number), test.state.viewport.hGrid * 8]]);
	});
	it('resolves arrays exposed by a project group', async () => {
		const test = await setup(barsPlugin, exposedSource);
		test.render();
		expect(vi.mocked(test.draw.drawFill).mock.calls.length).toBeGreaterThan(1);
	});
	it('removes stale data after source changes and restores it when memory becomes available', async () => {
		const test = await setup(barsPlugin, source);
		test.render();
		expect(test.draw.drawFill).toHaveBeenCalled();
		test.update(['module audio', '; @bars &missing 4', 'moduleEnd']);
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		test.update(source);
		test.render();
		expect(test.draw.drawFill).toHaveBeenCalled();
	});
	it('is optional, releases layout and drawing, and keeps editors independent', async () => {
		const omitted = await setup(barsPlugin, source, { installed: false });
		omitted.render();
		expect(omitted.block.gaps.size).toBe(0);
		expect(omitted.draw.drawFill).not.toHaveBeenCalled();
		const first = await setup(barsPlugin, source);
		const second = await setup(barsPlugin, source);
		first.dispose();
		first.update(source);
		first.render();
		second.render();
		expect(first.block.gaps.size).toBe(0);
		expect(first.draw.drawFill).not.toHaveBeenCalled();
		expect(second.draw.drawFill).toHaveBeenCalled();
	});
});
