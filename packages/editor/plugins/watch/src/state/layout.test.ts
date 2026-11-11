import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { describe, expect, it, vi } from 'vitest';
import { setup } from '../__tests__/setup';
import { createWatchPlugin } from '../index';

const plugin = createWatchPlugin({ prefersReducedMotion: () => true });

describe('prepared watch rendering', () => {
	it('refreshes named and inline fixed-reference reads after recompilation', async () => {
		const source = (padding = '') => [
			'module source',
			padding,
			'int[] samples 2 3 4',
			'moduleEnd',
			'module audio',
			'int& buffer &source:samples ; @watch *[1]',
			'; @watch *buffer[1]',
			'moduleEnd',
		];
		const test = await setup(plugin, source());
		const values = () => {
			test.render();
			return vi.mocked(test.draw.drawNumericText).mock.calls.map(call => call[2]);
		};
		expect(values()).toEqual(['4', '4']);
		const project = parseProjectSource(['8f4e/v1', 'entry main', ...source('int padding'), 'entryEnd'].join('\n'));
		const replacement = await compileProject(project, { cache: test.compiled.cache });
		test.store.set('compiler.isCompiling', true);
		test.store.set('compiler.result', replacement);
		test.store.set('compiler.isCompiling', false);
		test.memoryViews.int32[replacement.memoryPlan.modules.source.memory.samples.allocationUnitAddress + 1] = 9;
		expect(values()).toEqual(['9', '9']);
	});

	it('renders live pointer targets without repeating declaration-name lookup', async () => {
		const test = await setup(plugin, [
			'module audio',
			'int first 3',
			'int second 4',
			'int* pointer &first',
			'; @watch *pointer',
			'moduleEnd',
		]);
		const memory = test.compiled.memoryPlan.modules.audio.memory;
		const pointer = memory.pointer;
		const lookup = vi.fn(() => pointer);
		Object.defineProperty(memory, 'pointer', { configurable: true, get: lookup });
		for (const target of [memory.first, memory.second]) {
			test.memoryViews.int32[pointer.allocationUnitAddress] = target.byteAddress;
			test.render();
			expect(test.draw.drawNumericText).toHaveBeenCalledWith(
				expect.any(Number),
				expect.any(Number),
				String(test.memoryViews.int32[target.allocationUnitAddress]),
				expect.any(Number)
			);
		}
		expect(lookup).not.toHaveBeenCalled();
	});

	it('keeps end-address and indexed hexadecimal displays live when a pointer retargets', async () => {
		const test = await setup(plugin, [
			'module audio',
			'int8u[] first 4 1 2 3 4',
			'int8u[] second 2 5 6',
			'int8u* pointer &first',
			'; @watch end(*pointer)',
			'; @watch 0x*pointer[1]',
			'moduleEnd',
		]);
		const { first, second, pointer } = test.compiled.memoryPlan.modules.audio.memory;
		for (const [target, hex] of [
			[first, '02'],
			[second, '06'],
		] as const) {
			test.memoryViews.int32[pointer.allocationUnitAddress] = target.byteAddress;
			test.render();
			expect(vi.mocked(test.draw.drawNumericText).mock.calls.map(call => call[2])).toEqual([
				String(target.endByteAddress),
				hex,
			]);
		}
	});
});
