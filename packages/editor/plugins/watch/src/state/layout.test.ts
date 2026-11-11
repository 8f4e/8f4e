import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { describe, expect, it, vi } from 'vitest';
import { setup } from '../__tests__/setup';
import { createWatchPlugin } from '../index';

const plugin = createWatchPlugin({ prefersReducedMotion: () => true });

describe('prepared watch rendering', () => {
	it('resolves named, indexed, module and fixed-reference boundary selectors', async () => {
		const test = await setup(plugin, [
			'module source',
			'int8[] bytes 3 1 2 3',
			'int16[] words 3 4 5 6',
			'int8[] empty 0',
			'int tail 7',
			'moduleEnd',
			'module audio',
			'int marker 8',
			'int8& connected &source:bytes',
			'int8& emptyConnection &source:empty',
			'; @watch end(source:bytes)',
			'; @watch end(source:words)',
			'; @watch end(source:empty)',
			'; @watch end(source:0)',
			'; @watch end(source:)',
			'; @watch end(*connected)',
			'; @watch end(*emptyConnection)',
			'; @watch end(this)',
			'; @watch end(this:0)',
			'moduleEnd',
		]);
		test.render();
		const { source, audio } = test.compiled.memoryPlan.modules;
		expect(vi.mocked(test.draw.drawNumericText).mock.calls.map(call => call[2])).toEqual(
			[
				source.memory.bytes.byteAddress + 3,
				source.memory.words.byteAddress + 6,
				source.memory.empty.byteAddress,
				source.memory.bytes.byteAddress + 3,
				source.byteAddress + source.allocatedByteLength,
				source.memory.bytes.byteAddress + 3,
				source.memory.empty.byteAddress,
				audio.byteAddress + audio.allocatedByteLength,
				audio.memory.marker.byteAddress + 4,
			].map(String)
		);
	});

	it('resolves inline ends and ignores invalid boundary targets', async () => {
		const test = await setup(plugin, [
			'module audio',
			'int8[] bytes 3 1 2 3 ; @watch end()',
			'int8& connected &bytes ; @watch end(*)',
			'int8& other &bytes ; @watch end()',
			'; @watch end(connected)',
			'; @watch end(*bytes)',
			'; @watch end(**connected)',
			'moduleEnd',
		]);
		test.render();
		const end = String(test.compiled.memoryPlan.modules.audio.memory.bytes.byteAddress + 3);
		expect(vi.mocked(test.draw.drawNumericText).mock.calls.map(call => call[2])).toEqual([end, end]);
	});

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
