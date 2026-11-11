import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { describe, expect, it, vi } from 'vitest';
import {
	resolveElementCount,
	resolveTypedValueSpec,
} from '~/features/code-blocks/features/directives/shared/typedValueSpec';
import resolveMemoryIdentifier, { resolveMemoryAddress } from '~/pureHelpers/resolveMemoryIdentifier';
import resolveMemoryTarget, { type MemoryScope } from '~/pureHelpers/resolveMemoryTarget';
import { createMockState } from '~/pureHelpers/testingUtils/testUtils';

const scope: MemoryScope = { kind: 'module', moduleId: 'audio/sink' };
const source = (padding = '') => `8f4e/v1
entry main
group audio
entry main
group bank
expose samples &source:samples
expose length &source:length
entry main
module source
${padding}
float[] samples 4 -1 0 1 0
int length 4
moduleEnd
entryEnd
groupEnd
module sink
float& buffer &bank:samples
int& length &bank:length
float* pointer &bank:samples
moduleEnd
entryEnd
groupEnd
entryEnd`;

async function setup() {
	const compiled = await compileProject(parseProjectSource(source()));
	const state = createMockState();
	state.compiler.result = compiled;
	state.callbacks.getWordFromMemory = vi.fn(() => 0);
	return { state, compiled };
}

describe('shared fixed reference resolution', () => {
	it('retains the public reference identity and the backing module and declaration', async () => {
		const { state, compiled } = await setup();
		const reference = compiled.compiledModules['audio/sink'].referenceSlots.buffer;
		const resolved = resolveMemoryTarget(state, scope, 'buffer')!;
		expect(resolved).toMatchObject({
			publicModuleId: 'audio/sink',
			publicName: 'buffer',
			moduleId: 'audio/bank/source',
		});
		expect(resolved.reference).toBe(reference);
		expect(resolved.memory).toBe(reference.targetMemory);
		expect(compiled.memoryPlan.modules['audio/sink'].memory.buffer).toBeUndefined();

		for (const [otherScope, name] of [
			[{ kind: 'module', moduleId: 'audio/sink' }, 'sink:buffer'],
			[{ kind: 'project', groupPath: 'audio' }, 'sink:buffer'],
			[{ kind: 'project', groupPath: '' }, 'audio/sink:buffer'],
		] as const) {
			expect(resolveMemoryTarget(state, otherScope, name)?.reference).toBe(reference);
		}
		expect(resolveMemoryTarget(state, { kind: 'project', groupPath: 'audio' }, 'buffer')).toBeUndefined();
	});

	it('uses the fixed address for buffer sources and the target storage for dereferenced values and counts', async () => {
		const { state, compiled } = await setup();
		const memory = compiled.memoryPlan.modules['audio/bank/source'].memory.samples;
		const address = resolveMemoryIdentifier(state, scope, 'buffer')!;
		expect(address).toMatchObject({ showAddress: true, bufferPointer: 0 });
		expect(address.memory).toBe(memory);
		expect(resolveTypedValueSpec(address)).toMatchObject({ valueType: 'float32', elementByteSize: 4 });
		expect(resolveMemoryIdentifier(state, scope, '*buffer[2]')).toMatchObject({
			showAddress: false,
			bufferPointer: 2,
			memory,
		});
		expect(resolveElementCount('count(buffer)', scope, state)).toBe(4);
		expect(resolveElementCount('length', scope, state)).toMatchObject({
			memory: compiled.memoryPlan.modules['audio/bank/source'].memory.length,
		});
		expect(resolveMemoryIdentifier(state, scope, '&buffer')).toBeUndefined();
		expect(resolveMemoryAddress(state, scope, 'buffer')?.memory).toBe(memory);
		expect(resolveMemoryAddress(state, scope, 'pointer')).toBeUndefined();
		expect(state.callbacks.getWordFromMemory).not.toHaveBeenCalled();

		const pointer = compiled.memoryPlan.modules['audio/sink'].memory.pointer;
		expect(resolveMemoryIdentifier(state, scope, 'pointer')).toMatchObject({ showAddress: false, memory: pointer });
		expect(resolveMemoryIdentifier(state, scope, '&pointer')).toMatchObject({ showAddress: true, memory: pointer });
	});

	it.each([
		['int8', 'int8', 1],
		['int8u', 'uint8', 1],
		['int16', 'int16', 2],
		['int16u', 'uint16', 2],
		['int', 'int32', 4],
		['float', 'float32', 4],
		['float64', 'float64', 8],
	])('uses the backing %s sample format', async (type, valueType, elementByteSize) => {
		const compiled = await compileProject(
			parseProjectSource(`8f4e/v1
entry main
module audio
${type}[] samples 4
${type}& buffer &samples
moduleEnd
entryEnd`)
		);
		const state = createMockState();
		state.compiler.result = compiled;
		const address = resolveMemoryIdentifier(state, { kind: 'module', moduleId: 'audio' }, 'buffer')!;
		expect(resolveTypedValueSpec(address)).toMatchObject({ valueType, elementByteSize });
	});

	it('follows replacement compiler metadata and drops removed references', async () => {
		const { state, compiled } = await setup();
		const previous = resolveMemoryTarget(state, scope, 'buffer')!;
		const replacement = await compileProject(parseProjectSource(source('int padding')), { cache: compiled.cache });
		state.compiler.result = replacement;
		const next = resolveMemoryTarget(state, scope, 'buffer')!;
		expect(next.memory.byteAddress).not.toBe(previous.memory.byteAddress);
		expect(next.memory).toBe(replacement.compiledModules['audio/sink'].referenceSlots.buffer.targetMemory);
		state.compiler.result.compiledModules = {};
		expect(resolveMemoryTarget(state, scope, 'buffer')).toBeUndefined();
		expect(resolveMemoryIdentifier(state, scope, '*buffer')).toBeUndefined();
	});
});
