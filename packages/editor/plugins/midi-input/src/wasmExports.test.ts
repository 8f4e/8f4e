import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWasmExports } from './wasmExports';

afterEach(() => vi.restoreAllMocks());

describe('MIDI WebAssembly exports', () => {
	it('waits for compilation and caches the current bytecode and memory, including pending calls', async () => {
		const compiled = await compileProject(
			parseProjectSource(`8f4e/v1
function answer
#export answer
push 7
functionEnd int`),
			{ disableSharedMemory: true }
		);
		let memory: WebAssembly.Memory | null = null;
		let code = new Uint8Array();
		const instantiate = vi.spyOn(WebAssembly, 'instantiate');
		const getExports = createWasmExports({ getMemory: () => memory, getCodeBuffer: () => code });
		expect(await getExports()).toBeUndefined();
		memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
		expect(await getExports()).toBeUndefined();
		code = new Uint8Array(compiled.codeBuffer);
		const [first, second] = await Promise.all([getExports(), getExports()]);
		expect(first).toBe(second);
		expect((first!.answer as () => number)()).toBe(7);
		expect(await getExports()).toBe(first);
		expect(instantiate).toHaveBeenCalledOnce();
		memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
		expect(await getExports()).not.toBe(first);
		code = new Uint8Array(code);
		await getExports();
		expect(instantiate).toHaveBeenCalledTimes(3);
	});

	it('retries after a failed instantiation', async () => {
		const instantiate = vi.spyOn(WebAssembly, 'instantiate');
		const memory = new WebAssembly.Memory({ initial: 1 });
		const getExports = createWasmExports({ getMemory: () => memory, getCodeBuffer: () => code });
		const code = new Uint8Array([1, 2, 3]);
		await expect(getExports()).rejects.toThrow();
		await expect(getExports()).rejects.toThrow();
		expect(instantiate).toHaveBeenCalledTimes(2);
	});
});
