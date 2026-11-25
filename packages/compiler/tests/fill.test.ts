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
		expect(/^\s+if\b/m.test(wat)).toBe(enableMemoryGuards);
		expect(wat).not.toContain('memory.size');
	});

	it('exposes native out-of-bounds traps when memory guards are disabled', async () => {
		const result = await compileProject(parseProjectSource(source), { enableMemoryGuards: false });
		const memory = createMemory(result.requiredMemoryBytes);
		const bytes = new Uint8Array(memory.buffer);
		const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), { host: { memory } });
		const fill = instance.exports.fillBytes as (address: number, value: number, count: number) => void;
		bytes[bytes.length - 1] = 255;
		expect(() => fill(bytes.length - 1, 0, 2)).toThrow(WebAssembly.RuntimeError);
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
			inFunction: false,
		},
		{
			name: 'page padding beyond all declarations',
			declarations: 'int first 1',
			address: '65532',
			length: 'push 4',
			inFunction: false,
		},
		{
			name: 'the empty range at the memory end',
			declarations: 'int first 1',
			address: '65536',
			length: 'push 0',
			inFunction: false,
		},
		{
			name: 'a second imported memory page in a module',
			declarations: 'int8u[] padding 65536\nint first 1',
			address: '65536',
			length: 'push 4',
			inFunction: false,
		},
		{
			name: 'a second imported memory page in a function',
			declarations: 'int8u[] padding 65536\nint first 1',
			address: '65536',
			length: 'push 4',
			inFunction: true,
		},
	])('omits the guard for $name', async ({ declarations, address, length, inFunction }) => {
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
		expect(wat).not.toMatch(/^\s+if\b/m);
	});

	it('uses an existing clamp guarantee for a dynamic address', async () => {
		const compileClamped = async (body: string) => {
			const result = await compileProject(
				parseProjectSource(`8f4e/v1
function clamped
#export
#impure
param int address
push address
clampGlobalAddress 8
${body}`)
			);
			return disassembleWasm(result.codeBuffer);
		};
		const wat = await compileClamped('push 67\npush 8\nfill\nfunctionEnd');
		const clampWat = await compileClamped('functionEnd int');
		// Fill adds no bounds checks beyond those already emitted for the clamp.
		expect(wat.match(/^\s+if\b/gm) ?? []).toHaveLength((clampWat.match(/^\s+if\b/gm) ?? []).length);
	});
});
