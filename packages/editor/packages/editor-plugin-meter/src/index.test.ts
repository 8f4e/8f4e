import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { describe, expect, it } from 'vitest';
import { exposedSource } from './__tests__/exposed-source';
import { setup } from './__tests__/setup';
import { meterPlugin } from './index';

const source = ['module audio', 'float level 0.5 ; @meter', 'moduleEnd'];
describe('meter plugin', () => {
	it.each(['int8', 'int8u', 'int16', 'int16u', 'int', 'float', 'float64'])('draws a scalar %s meter', async type => {
		const test = await setup(meterPlugin, [
			'module audio',
			`${type.startsWith('int') && type !== 'int' ? type + '[] level 1' : type + ' level'} 1 ; @meter`,
			'moduleEnd',
		]);
		test.render();
		expect(test.block.gaps.get(1)?.size).toBe(1);
		expect(test.draw.drawFill).toHaveBeenCalledWith(
			0,
			0,
			PALETTE_INDICES.darkSurface,
			expect.any(Number),
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
