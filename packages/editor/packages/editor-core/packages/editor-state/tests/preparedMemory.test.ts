import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { describe, expect, it, vi } from 'vitest';
import {
	prepareAddressBinding,
	prepareAddressedRead,
	prepareBuffer,
	prepareElementCount,
	prepareNumericRead,
	readByteAddress,
	readDeclarationEndAddress,
	readElementCount,
	readElementIndex,
	readNumericValue,
} from '~/pureHelpers/preparedMemory';
import { getDeclarationsByByteAddress, prepareMemoryAccess } from '~/pureHelpers/resolveMemoryIdentifier';
import { createMockState } from '~/pureHelpers/testingUtils/testUtils';

const scope = { kind: 'module', moduleId: 'storage' } as const;
const source = (type = 'float') => `8f4e/v1
entry main
module storage
${type}[] samples 4
${type}[] alternate 4
${type}& fixed &samples
${type}* pointer &samples
${type}** indirect &pointer
int*[] pointers 2
int length 3
int& count &length
int8u[] narrowLength 1 3
moduleEnd
entryEnd`;

async function setup(type = 'float') {
	const project = parseProjectSource(source(type));
	const compiled = await compileProject(project);
	const state = createMockState();
	state.compiler.result = compiled;
	state.callbacks.getWordFromMemory = vi.fn();
	const pages = Math.max(1, Math.ceil(compiled.requiredMemoryBytes / 65536));
	const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
	const { instance } = await WebAssembly.instantiate(new Uint8Array(compiled.codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as CallableFunction)();
	const views = {
		int8: new Int8Array(memory.buffer),
		uint8: new Uint8Array(memory.buffer),
		int16: new Int16Array(memory.buffer),
		uint16: new Uint16Array(memory.buffer),
		int32: new Int32Array(memory.buffer),
		float32: new Float32Array(memory.buffer),
		float64: new Float64Array(memory.buffer),
	};
	const declarations = compiled.memoryPlan.modules.storage.memory;
	views.int32[declarations.pointers.allocationUnitAddress] = declarations.samples.byteAddress;
	views.int32[declarations.pointers.allocationUnitAddress + 1] = declarations.alternate.byteAddress;
	const access = (expression: string) => prepareMemoryAccess(state, scope, expression)!;
	return { state, compiled, views, access, memory: compiled.memoryPlan.modules.storage.memory };
}

describe('prepared memory bindings', () => {
	it('reads one pointer level from double pointers using 32-bit pointer storage', async () => {
		const { access, views, memory } = await setup('float64');
		const read = prepareAddressedRead(access('indirect'))!;
		expect(read.spec).toMatchObject({ valueType: 'int32', elementByteSize: 4, isInteger: true });
		expect(readNumericValue(read, views)).toBe(memory.samples.byteAddress);
	});
	it.each([
		{ type: 'int8', view: 'int8', size: 1, first: -12, second: 34 },
		{ type: 'int8u', view: 'uint8', size: 1, first: 200, second: 255 },
		{ type: 'int16', view: 'int16', size: 2, first: -1234, second: 2345 },
		{ type: 'int16u', view: 'uint16', size: 2, first: 40000, second: 65535 },
		{ type: 'int', view: 'int32', size: 4, first: -123456, second: 234567 },
		{ type: 'float', view: 'float32', size: 4, first: 1.5, second: 2.75 },
		{ type: 'float64', view: 'float64', size: 8, first: Math.PI, second: Math.E },
	] as const)('normalizes $type fixed, indexed and live-pointer reads', async ({ type, view, size, first, second }) => {
		const { state, views, access, memory } = await setup(type);
		views[view][memory.samples.byteAddress / size + 1] = first;
		views[view][memory.alternate.byteAddress / size + 1] = second;
		const direct = prepareAddressBinding(access('&samples[1]'))!;
		const reference = prepareAddressBinding(access('fixed[1]'))!;
		expect(direct).toEqual({ kind: 'fixed', byteAddress: memory.samples.byteAddress + size });
		expect(reference).toEqual(direct);
		const read = prepareNumericRead(access('*pointer[1]'))!;
		expect(read.spec).toMatchObject({ valueType: view, elementByteSize: size });
		expect(readNumericValue(read, views)).toBe(first);
		expect(readNumericValue(prepareNumericRead(access('*fixed[1]'))!, views)).toBe(first);
		expect(readElementIndex(read, views.int32)).toBe(memory.samples.byteAddress / size + 1);
		expect(readByteAddress(prepareAddressBinding(access('pointers[1]'))!, views.int32)).toBe(
			memory.alternate.byteAddress
		);
		expect(readByteAddress(prepareAddressBinding(access('&pointers[1]'))!, views.int32)).toBe(
			memory.pointers.byteAddress + 4
		);
		views.int32[memory.pointer.allocationUnitAddress] = memory.alternate.byteAddress;
		expect(readNumericValue(read, views)).toBe(second);
		expect(readNumericValue(prepareNumericRead(access('pointer'))!, views)).toBe(memory.alternate.byteAddress);
		expect(state.callbacks.getWordFromMemory).not.toHaveBeenCalled();
	});

	it('retains buffer ownership and prepares literal, metadata and live typed counts', async () => {
		const { state, views, memory } = await setup();
		const buffer = prepareBuffer(state, scope, 'fixed', 'count(fixed)')!;
		expect(buffer.target.moduleId).toBe('storage');
		expect(buffer.target.memory).toBe(memory.samples);
		expect(buffer.target.reference).toBe(state.compiler.result.compiledModules.storage.referenceSlots.fixed);
		expect(readElementCount(buffer.elementCount, views)).toBe(4);
		for (const expression of [3, 'length', 'count', 'narrowLength']) {
			const count = prepareElementCount(state, scope, expression)!;
			expect(readElementCount(count, views)).toBe(3);
		}
		const live = prepareElementCount(state, scope, 'count')!;
		views.int32[memory.length.allocationUnitAddress] = 0;
		expect(readElementCount(live, views)).toBe(0);
		views.int32[memory.length.allocationUnitAddress] = 2;
		expect(readElementCount(live, views)).toBe(2);
		expect(prepareElementCount(state, scope, 0)).toBeUndefined();
	});

	it('follows live buffers and uses current views without repeating declaration lookup', async () => {
		const { state, views, access, memory } = await setup('float64');
		const buffer = prepareBuffer(state, scope, 'pointer', 'length')!;
		const read = prepareNumericRead(access('*pointer[1]'))!;
		const pointer = memory.pointer;
		const lookup = vi.fn(() => pointer);
		Object.defineProperty(memory, 'pointer', { configurable: true, get: lookup });
		views.float64[memory.samples.byteAddress / 8 + 1] = Math.PI;
		expect(readNumericValue(read, views)).toBe(Math.PI);
		views.int32[pointer.allocationUnitAddress] = memory.alternate.byteAddress;
		views.float64 = new Float64Array(views.float64.length);
		views.float64[memory.alternate.byteAddress / 8 + 1] = Math.E;
		expect(readNumericValue(read, views)).toBe(Math.E);
		expect(readElementIndex(buffer.samples, views.int32)).toBe(memory.alternate.byteAddress / 8);
		expect(lookup).not.toHaveBeenCalled();
	});

	it('handles unavailable runtime storage and keeps declaration boundary reads separate from element offsets', async () => {
		const { state, views, access, memory } = await setup();
		const pointer = prepareAddressBinding(access('pointer'))!;
		expect(readByteAddress(pointer, new Int32Array(0))).toBeUndefined();
		views.int32[memory.pointer.allocationUnitAddress] = -1;
		expect(readByteAddress(pointer, views.int32)).toBe(0xffffffff);
		expect(readNumericValue(prepareNumericRead(access('*pointer'))!, views)).toBeUndefined();
		views.int32[memory.pointer.allocationUnitAddress] = memory.samples.byteAddress;
		const declarations = getDeclarationsByByteAddress(state.compiler.result.memoryPlan)!;
		expect(readDeclarationEndAddress(readByteAddress(pointer, views.int32), declarations)).toBe(
			memory.samples.endByteAddress
		);
		expect(prepareAddressBinding(access('length'))).toBeUndefined();
		expect(prepareAddressBinding(access('&fixed'))).toBeUndefined();
	});

	it('refreshes fixed bindings and indices from replacement compiler metadata', async () => {
		const { state, compiled, views } = await setup('float64');
		const previous = prepareBuffer(state, scope, 'fixed', 'count(fixed)')!;
		const replacement = await compileProject(parseProjectSource(source('float64')), {
			cache: compiled.cache,
			startingMemoryAllocationUnitAddress: 32,
		});
		state.compiler.result = replacement;
		const next = prepareBuffer(state, scope, 'fixed', 'count(fixed)')!;
		expect(next.samples.elementIndex).not.toBe(previous.samples.elementIndex);
		expect(next.target.memory).toBe(replacement.memoryPlan.modules.storage.memory.samples);
		views.float64[next.target.memory.byteAddress / 8] = 7.5;
		expect(readNumericValue(next.samples, views)).toBe(7.5);
	});
});
