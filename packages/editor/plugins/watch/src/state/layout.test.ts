import { compileProject, parseProjectSource } from '@8f4e/compiler';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import { setup } from '../__tests__/setup';
import type { WatchValue } from '../types';
import { registerWatchLayout } from './layout';

describe('watch memory preparation', () => {
	it('retains named and inline fixed-reference accesses until compilation changes', async () => {
		const watches = new WeakMap<CodeBlockGraphicData, WatchValue[]>();
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
		const test = await setup(
			{ id: 'watch-layout', setup: ({ layout }) => registerWatchLayout(layout, watches) },
			source()
		);
		const initial = watches.get(test.block)!;
		expect(initial).toHaveLength(2);
		const accesses = initial.map(watch => watch.resolveMemory()!);
		for (const [index, watch] of initial.entries()) {
			expect(accesses[index]).toMatchObject({ showAddress: false, bufferPointer: 1 });
			expect(watch.resolveMemory()).toBe(accesses[index]);
			expect(watch.resolveMemory()).toBe(accesses[index]);
		}

		const project = parseProjectSource(['8f4e/v1', 'entry main', ...source('int padding'), 'entryEnd'].join('\n'));
		const replacement = await compileProject(project, { cache: test.compiled.cache });
		test.store.set('compiler.isCompiling', true);
		test.store.set('compiler.result', replacement);
		test.store.set('compiler.isCompiling', false);
		for (const [index, watch] of watches.get(test.block)!.entries()) {
			const next = watch.resolveMemory()!;
			expect(next).not.toBe(accesses[index]);
			expect(next.memory.byteAddress).not.toBe(accesses[index].memory.byteAddress);
			expect(next.memory).toBe(replacement.compiledModules.audio.referenceSlots.buffer.targetMemory);
			expect(watch.resolveMemory()).toBe(next);
		}
	});

	it('continues resolving a runtime pointer that initially has no target and later retargets', async () => {
		const watches = new WeakMap<CodeBlockGraphicData, WatchValue[]>();
		const test = await setup({ id: 'watch-layout', setup: ({ layout }) => registerWatchLayout(layout, watches) }, [
			'module audio',
			'int first 3',
			'int second 4',
			'int* pointer 0',
			'; @watch *pointer',
			'moduleEnd',
		]);
		const [watch] = watches.get(test.block)!;
		const memory = test.compiled.memoryPlan.modules.audio.memory;
		expect(watch.resolveMemory()).toBeUndefined();
		test.memoryViews.int32[memory.pointer.allocationUnitAddress] = memory.first.byteAddress;
		expect(watch.resolveMemory()?.memory).toBe(memory.first);
		test.memoryViews.int32[memory.pointer.allocationUnitAddress] = memory.second.byteAddress;
		expect(watch.resolveMemory()?.memory).toBe(memory.second);
	});
});
