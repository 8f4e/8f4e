import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';
import { disassembleWasm } from './wasmTestUtils';

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
entryEnd`),
				{ enableFunctionInlining: false }
			);
			const target = result.memoryPlan.modules.source.memory.output;
			expect(result.memoryPlan.modules.sink.memory).toEqual({});
			expect(result.memoryPlan.modules.sink.allocatedByteLength).toBe(0);
			expect(result.memoryDefaultsByModuleId.sink).toEqual({});
			expect(result.compiledModules.sink.referenceSlots.input).toMatchObject({
				type: 'float&',
				targetModuleId: 'source',
				targetMemory: { id: 0, name: 'output' },
			});
			expect(result.compiledModules.sink.referenceSlots.input.targetMemory).toBe(target);
			expect(result.compiledModules.source.referenceSlots).toEqual({});
			const wat = await disassembleWasm(result.codeBuffer);
			expect(wat).toMatch(new RegExp(`i32\\.const ${target.byteAddress}\\s+f32\\.load\\s+drop`));
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
		expect(firstSlot.targetMemory.name).toBe('output');
	});
});
