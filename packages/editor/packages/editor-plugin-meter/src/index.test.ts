import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { describe, expect, it } from 'vitest';
import { exposedSource } from './__tests__/exposed-source';
import { setup } from './__tests__/setup';
import { meterPlugin } from './index';

const source = ['module audio', 'float level 0.5 ; @meter', 'moduleEnd'];
describe('meter plugin', () => {
	it.each([
		{ type: 'int8', declaration: 'int8[] level 1 -64', range: '-128 128' },
		{ type: 'int8u', declaration: 'int8u[] level 1 200', range: '0 400' },
		{ type: 'int16', declaration: 'int16[] level 1 -16384', range: '-32768 32768' },
		{ type: 'int16u', declaration: 'int16u[] level 1 40000', range: '0 80000' },
		{ type: 'int', declaration: 'int level -1073741824', range: '-2147483648 2147483648' },
		{ type: 'float', declaration: 'float level 0.5', range: '0 1' },
		{ type: 'float64', declaration: 'float64 level 0.125', range: '0 0.25' },
	])('draws the live $type value at half amplitude', async ({ declaration, range }) => {
		const test = await setup(meterPlugin, ['module audio', `${declaration} ; @meter level ${range}`, 'moduleEnd']);
		test.render();
		expect(test.block.gaps.get(1)?.size).toBe(1);
		expect(test.draw.drawFill).toHaveBeenCalledWith(
			0,
			0,
			PALETTE_INDICES.darkSurface,
			expect.any(Number),
			test.state.viewport.hGrid
		);
		const width = test.block.width - (test.block.lineNumberColumnWidth + 2) * test.state.viewport.vGrid;
		expect(test.draw.drawFill).toHaveBeenCalledWith(
			0,
			0,
			PALETTE_INDICES.positiveBase,
			Math.round(width / 2),
			test.state.viewport.hGrid
		);
	});
	it('reads pointer sources and honors explicit ranges', async () => {
		const test = await setup(meterPlugin, [
			'module audio',
			'float level 0.5',
			'float* pointer &level',
			'; @meter pointer 0 1',
			'moduleEnd',
		]);
		test.render();
		const width = test.block.width - (test.block.lineNumberColumnWidth + 2) * test.state.viewport.vGrid;
		expect(test.draw.drawFill).toHaveBeenCalledWith(
			0,
			0,
			PALETTE_INDICES.positiveBase,
			Math.round(width / 2),
			test.state.viewport.hGrid
		);
	});
	it('resolves exposed scalar memory', async () => {
		const test = await setup(meterPlugin, exposedSource);
		test.render();
		const width = test.block.width - (test.block.lineNumberColumnWidth + 2) * test.state.viewport.vGrid;
		expect(test.draw.drawFill).toHaveBeenCalledWith(
			0,
			0,
			PALETTE_INDICES.positiveBase,
			Math.round(width / 4),
			test.state.viewport.hGrid
		);
		const level = test.compiled.memoryPlan.modules['audio/voice'].memory.level;
		test.memoryViews.float32[level.allocationUnitAddress] = 0.5;
		test.render();
		expect(test.draw.drawFill).toHaveBeenCalledWith(
			0,
			0,
			PALETTE_INDICES.positiveBase,
			Math.round(width / 2),
			test.state.viewport.hGrid
		);
	});
	it('drops unresolved references and rebuilds after edits', async () => {
		const test = await setup(meterPlugin, source);
		test.update(['module audio', '; @meter missing', 'moduleEnd']);
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		test.update(source);
		test.render();
		expect(test.draw.drawFill).toHaveBeenCalled();
	});
	it('is optional, disposes its contributions, and isolates editors', async () => {
		const omitted = await setup(meterPlugin, source, { installed: false });
		omitted.render();
		expect(omitted.block.gaps.size).toBe(0);
		expect(omitted.draw.drawFill).not.toHaveBeenCalled();
		const first = await setup(meterPlugin, source);
		const second = await setup(meterPlugin, source);
		first.dispose();
		first.update(source);
		first.render();
		second.render();
		expect(first.block.gaps.size).toBe(0);
		expect(first.draw.drawFill).not.toHaveBeenCalled();
		expect(second.draw.drawFill).toHaveBeenCalled();
	});
});
