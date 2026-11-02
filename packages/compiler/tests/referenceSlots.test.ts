import { createFunction, f32load, i32const } from '@8f4e/compiler-wasm-utils';
import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';

describe('fixed reference artifacts', () => {
	it('allocates no reference storage and emits one direct typed load', async () => {
		const result = await compileProject(
			parseProjectSource(`8f4e/v1
entry main
module source
float output 1.5
moduleEnd
module sink
float& input &source:output
push *input
drop
moduleEnd
entryEnd`),
			{ disableSharedMemory: true }
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
	});

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
		const first = await compileProject(source(''), { disableSharedMemory: true });
		const firstSlot = first.compiledModules.sink.referenceSlots.input;
		const originalAddress = firstSlot.targetMemory.byteAddress;
		const second = await compileProject(source('int padding'), { disableSharedMemory: true, cache: first.cache });
		expect(second.compiledModules.sink.referenceSlots.input.targetMemory.byteAddress).toBe(originalAddress + 4);
		expect(firstSlot.targetMemory.byteAddress).toBe(originalAddress);
	});
});
