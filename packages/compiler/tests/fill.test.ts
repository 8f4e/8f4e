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
