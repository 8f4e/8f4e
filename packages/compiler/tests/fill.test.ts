import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';
import { createMemory } from './testUtils';
import { disassembleWasm } from './wasmTestUtils';

const source = `8f4e/v1
function fillBytes
#export
#impure
param int address
param int value
param int count
push address
push value
push count
fill
functionEnd
entry main
module buffer
int value 42
moduleEnd
entryEnd`;

describe('native fill', () => {
	it.each([true, false])('emits memory.fill with memory guards %s', async enableMemoryGuards => {
		const result = await compileProject(parseProjectSource(source), { enableMemoryGuards });
		const wat = await disassembleWasm(result.codeBuffer);
		// One fill initializes memory; the other implements the exported function.
		expect(wat.match(/memory\.fill/g)).toHaveLength(2);
		expect(wat).not.toContain('(loop');
		expect(wat.includes('memory.size')).toBe(enableMemoryGuards);

		const memory = createMemory(result.requiredMemoryBytes);
		const bytes = new Uint8Array(memory.buffer);
		const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), { host: { memory } });
		const fill = instance.exports.fillBytes as (address: number, value: number, count: number) => void;
		fill(bytes.length - 1, 511, 1);
		expect(bytes.at(-1)).toBe(255);
		fill(bytes.length, 0, 0);
		if (enableMemoryGuards) {
			expect(() => fill(bytes.length - 1, 0, 2)).not.toThrow();
		} else {
			expect(() => fill(bytes.length - 1, 0, 2)).toThrow(WebAssembly.RuntimeError);
		}
		expect(bytes.at(-1)).toBe(255);
	});
});

describe('proven fill ranges', () => {
	it.each([
		{
			name: 'adjacent declarations',
			declarations: 'int first 1\nint second 2',
			address: '&first',
			length: 'push 2\npush sizeof(first)\nmul',
			offset: 0,
			bytes: 8,
			inFunction: false,
		},
		{
			name: 'page padding beyond all declarations',
			declarations: 'int first 1',
			address: '65532',
			length: 'push 4',
			offset: 65532,
			bytes: 4,
			inFunction: false,
		},
		{
			name: 'the empty range at the memory end',
			declarations: 'int first 1',
			address: '65536',
			length: 'push 0',
			offset: 65536,
			bytes: 0,
			inFunction: false,
		},
		{
			name: 'a second imported memory page in a module',
			declarations: 'int8u[] padding 65536\nint first 1',
			address: '65536',
			length: 'push 4',
			offset: 65536,
			bytes: 4,
			inFunction: false,
		},
		{
			name: 'a second imported memory page in a function',
			declarations: 'int8u[] padding 65536\nint first 1',
			address: '65536',
			length: 'push 4',
			offset: 65536,
			bytes: 4,
			inFunction: true,
		},
	])('omits the guard for $name', async ({ declarations, address, length, offset, bytes: count, inFunction }) => {
		const body = `push ${address}\npush 67\n${length}\nfill`;
		const program = `8f4e/v1
${inFunction ? `function run\n#export\n#impure\n${body}\nfunctionEnd` : ''}
entry main
module storage
${declarations}
${inFunction ? '' : body}
moduleEnd
entryEnd`;
		const result = await compileProject(parseProjectSource(program));
		const wat = await disassembleWasm(result.codeBuffer);
		expect(wat).not.toContain('memory.size');
		const memory = createMemory(result.requiredMemoryBytes);
		const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), { host: { memory } });
		(instance.exports.initDefaults as () => void)();
		(instance.exports[inFunction ? 'run' : 'main'] as () => void)();
		const fillOffset = address === '&first' ? result.memoryPlan.modules.storage.memory.first.byteAddress : offset;
		expect(new Uint8Array(memory.buffer, fillOffset, count)).toEqual(new Uint8Array(count).fill(67));
	});

	it.each([
		{ address: 65535, count: 2 },
		{ address: -1, count: 1 },
		{ address: 65537, count: 0 },
		{ address: 0, count: -1 },
	])('keeps the guard for address $address and count $count', async ({ address, count }) => {
		const result = await compileProject(
			parseProjectSource(`8f4e/v1
entry main
module storage
int first 1
push ${address}
push 0
push ${count}
fill
moduleEnd
entryEnd`)
		);
		expect(await disassembleWasm(result.codeBuffer)).toContain('memory.size');
		const memory = createMemory(result.requiredMemoryBytes);
		const bytes = new Uint8Array(memory.buffer);
		bytes.fill(91);
		const before = bytes.slice();
		const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), { host: { memory } });
		expect(() => (instance.exports.main as () => void)()).not.toThrow();
		expect(bytes).toEqual(before);
	});

	it.each([
		{
			name: 'unsigned shift followed by signed division',
			address: 0,
			count: 'push -2147483648\npush 0\nshiftRightUnsigned\npush 2147483647\ndiv',
		},
		{
			name: 'large integer constants and cancellation',
			address: 65536,
			count: 'push 2^53\npush 1\nadd\npush 2^53\nsub',
		},
	])('keeps ranges sound through $name', async ({ address, count }) => {
		const result = await compileProject(
			parseProjectSource(`8f4e/v1
entry main
module storage
int marker
push ${address}
push 0
${count}
fill
moduleEnd
entryEnd`)
		);
		expect(await disassembleWasm(result.codeBuffer)).toContain('memory.size');
		const memory = createMemory(result.requiredMemoryBytes);
		const bytes = new Uint8Array(memory.buffer);
		bytes.fill(91);
		const before = bytes.slice();
		const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), { host: { memory } });
		expect(() => (instance.exports.main as () => void)()).not.toThrow();
		expect(bytes).toEqual(before);
	});

	it('uses an existing clamp guarantee for a dynamic address', async () => {
		const clamped = source.replace(
			'push address\npush value\npush count',
			'push address\nclampGlobalAddress 8\npush value\npush 8'
		);
		const result = await compileProject(parseProjectSource(clamped));
		const wat = await disassembleWasm(result.codeBuffer);
		const clampOnly = clamped.replace('push value\npush 8\nfill\nfunctionEnd', 'functionEnd int');
		const clampResult = await compileProject(parseProjectSource(clampOnly));
		const clampWat = await disassembleWasm(clampResult.codeBuffer);
		// Fill adds no bounds checks beyond those already emitted for the clamp.
		expect(wat.match(/memory\.size/g) ?? []).toHaveLength((clampWat.match(/memory\.size/g) ?? []).length);
		const memory = createMemory(result.requiredMemoryBytes);
		const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), { host: { memory } });
		(instance.exports.fillBytes as (address: number, value: number, count: number) => void)(
			memory.buffer.byteLength + 4096,
			67,
			8
		);
		expect(new Uint8Array(memory.buffer).slice(-8)).toEqual(new Uint8Array(8).fill(67));
	});
});
