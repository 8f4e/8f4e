import { createFunction, f32load, i32const } from '@8f4e/compiler-wasm-utils';
import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';

describe('fixed reference artifacts', () => {
	it.each(['&source:output', '&source:0'])(
		'allocates no reference storage and emits one direct typed load for %s',
		async targetAddress => {
			const result = await compileProject(
				parseProjectSource(`8f4e/v1
entry main
module source
float output 1.5
moduleEnd
module sink
float& input ${targetAddress}
push *input
drop
moduleEnd
entryEnd`)
			);
			const target = result.memoryPlan.modules.source.memory.output;
			expect(result.memoryPlan.modules.sink.memory).toEqual({});
			expect(result.memoryPlan.modules.sink.allocatedByteLength).toBe(0);
			expect(result.memoryDefaultsByModuleId.sink).toEqual({});
			expect(result.compiledModules.sink.referenceSlots.input).toMatchObject({
				type: 'float&',
				targetModuleId: 'source',
				targetMemory: { id: 'output' },
			});
			expect(result.compiledModules.sink.referenceSlots.input.targetMemory).toBe(target);
			expect(result.compiledModules.source.referenceSlots).toEqual({});
			expect(result.compiledModules.sink.cycleFunction).toEqual(
				createFunction([], [...i32const(target.byteAddress), ...f32load(2, 0), 0x1a])
			);
		}
	);

	it('rebinds cached references to the new layout without mutating earlier artifacts', async () => {
		const source = (padding: string) =>
			parseProjectSource(`8f4e/v1
entry main
module source
${padding}
float output 1.5
moduleEnd
module sink
float& input &source:output
push input
drop
moduleEnd
entryEnd`);
		const first = await compileProject(source(''));
		const firstSlot = first.compiledModules.sink.referenceSlots.input;
		const originalAddress = firstSlot.targetMemory.byteAddress;
		const second = await compileProject(source('int padding'), { cache: first.cache });
		expect(second.compiledModules.sink.referenceSlots.input.targetMemory.byteAddress).toBe(originalAddress + 4);
		expect(firstSlot.targetMemory.byteAddress).toBe(originalAddress);
	});

	it('resolves a cached declaration index against the new declaration order', async () => {
		const source = (padding: string) =>
			parseProjectSource(`8f4e/v1
entry main
module source
${padding}
float output 1.5
moduleEnd
module sink
float& input &source:0
push *input
drop
moduleEnd
entryEnd`);
		const first = await compileProject(source(''));
		const firstSlot = first.compiledModules.sink.referenceSlots.input;
		const second = await compileProject(source('float padding 2.5'), {
			cache: first.cache,
		});
		expect(second.compiledModules.sink.referenceSlots.input.targetMemory).toBe(
			second.memoryPlan.modules.source.memory.padding
		);
		expect(firstSlot.targetMemory).toBe(first.memoryPlan.modules.source.memory.output);
		expect(firstSlot.targetMemory.id).toBe('output');
	});
});
