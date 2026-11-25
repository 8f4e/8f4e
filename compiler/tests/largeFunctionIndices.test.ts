import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';
import { disassembleWasm, getWasmFunctionExportIndex } from './wasmTestUtils';

describe('large WebAssembly function indices', () => {
	it.each([127, 128, 255, 256])('invokes the correct export at function index %i', async functionIndex => {
		const functions = Array.from({ length: functionIndex - 1 }, (_, index) =>
			[
				`function f${index}`,
				index === functionIndex - 2 ? '#export selected' : '',
				`push ${index}`,
				'functionEnd int',
			].join('\n')
		);
		const result = await compileProject(parseProjectSource(`8f4e/v1\n${functions.join('\n\n')}`), {
			enableWasmPruning: false,
		});
		const wat = await disassembleWasm(result.codeBuffer);
		expect(getWasmFunctionExportIndex(wat, 'selected')).toBe(functionIndex);

		const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
		const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), { host: { memory } });
		expect((instance.exports.selected as CallableFunction)()).toBe(functionIndex - 2);
	});

	it('instantiates functions whose type indices exceed 127 and 255', async () => {
		const functions = Array.from({ length: 256 }, (_, index) => {
			const parameters = Array.from({ length: 8 }, (_, bit) => `param ${index & (1 << bit) ? 'float' : 'int'} p${bit}`);
			return [`function f${index}`, ...parameters, `push ${index}`, 'functionEnd int'].join('\n');
		});
		const source = `8f4e/v1\n${functions.join('\n\n')}\n\nfunction selected\n#export\npush 1234\nfunctionEnd int`;
		const result = await compileProject(parseProjectSource(source), { enableWasmPruning: false });
		const wat = await disassembleWasm(result.codeBuffer);
		const typeIndices = Array.from(wat.matchAll(/^ {2}\(func \(;\d+;\) \(type (\d+)\)/gm), ([, index]) =>
			Number(index)
		);
		expect(Math.max(...typeIndices)).toBeGreaterThan(255);

		const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
		const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), { host: { memory } });
		expect((instance.exports.selected as CallableFunction)()).toBe(1234);
	});
});
