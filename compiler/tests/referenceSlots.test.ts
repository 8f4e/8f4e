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

	it.each([
		['int', 'i32.load'],
		['int16', 'i32.load16_s'],
		['float', 'f32.load'],
	])('emits the slot address and exact load sequence for %s*&', async (type, finalLoad) => {
		const declaration = `${type}*& input &source:output`;
		const source = (reference: string, body = '') =>
			parseProjectSource(`8f4e/v1
entry main
module source
${type}* output -1
moduleEnd
module sink
${reference}
${body}
moduleEnd
entryEnd`);
		const options = { enableFunctionInlining: false, enableMemoryGuards: false };
		const result = await compileProject(
			source(declaration, 'push input\ndrop\npush *input\ndrop\npush **input\ndrop'),
			options
		);
		const target = result.memoryPlan.modules.source.memory.output;
		expect(result.memoryPlan.modules.sink.allocatedByteLength).toBe(0);
		expect(result.memoryDefaultsByModuleId.sink).toEqual({});
		expect(result.compiledModules.sink.referenceSlots.input).toMatchObject({
			type: `${type}*&`,
			lineNumber: 1,
			targetModuleId: 'source',
			targetMemory: { pointerDepth: 1, pointeeBaseType: type },
		});
		expect(result.compiledModules.sink.referenceSlots.input.targetMemory).toBe(target);

		const wat = await disassembleWasm(result.codeBuffer);
		const loadSequences = [
			[`i32.const ${target.byteAddress}`, 'drop'],
			[`i32.const ${target.byteAddress}`, 'i32.load', 'drop'],
			[`i32.const ${target.byteAddress}`, 'i32.load', finalLoad, 'drop'],
		];
		expect(wat.replace(/\s+/g, ' ')).toContain(loadSequences.flat().join(' '));

		const unusedReference = await compileProject(source(declaration), options);
		const noReference = await compileProject(source(''), options);
		expect(unusedReference.codeBuffer).toEqual(noReference.codeBuffer);
	});

	it.each(['float', 'float*'])('rebinds cached %s references without mutating earlier artifacts', async type => {
		const source = (padding: string) =>
			parseProjectSource(`8f4e/v1
entry main
module source
${padding}
${type} output
moduleEnd
module sink
${type}& input &source:output
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
