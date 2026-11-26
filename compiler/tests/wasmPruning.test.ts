import { createFunctionId } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import wabt from 'wabt';
import { compileProject, parseProjectSource } from '../src';
import { createMemory, getExportedFunction } from './testUtils';

describe('Wasm pruning', () => {
	it('keeps transitive callees and remaps referenced locals without inlining', async () => {
		const project = parseProjectSource(`8f4e/v1
function increment
#import increment
param int value
functionEnd int

function unused
#import unused
functionEnd

function dead
call unused
functionEnd

function relay
param int value
call increment value
functionEnd int

function run
#export
param int ignored
param int value
local float discarded
local int saved
call relay value
localSet saved
push saved
functionEnd int`);
		const result = await compileProject(project, { enableFunctionInlining: false, includeStackAnalysis: true });
		const wasm = new WebAssembly.Module(new Uint8Array(result.codeBuffer));
		expect(
			WebAssembly.Module.imports(wasm)
				.map(({ name }) => name)
				.sort()
		).toEqual(['increment', 'memory']);
		expect(result.compiledFunctions![createFunctionId('dead', [])].stackAnalysis).toEqual(
			expect.arrayContaining([expect.objectContaining({ instruction: 'call' })])
		);

		const instance = new WebAssembly.Instance(wasm, {
			host: { memory: createMemory(result.requiredMemoryBytes), increment: (value: number) => value + 1 },
		});
		expect(getExportedFunction(instance.exports, 'run')(99, 41)).toBe(42);
	});

	it('prunes unused locals before repeatedly inlining zero-operation bodies', async () => {
		const functions = ['function fold0\nlocal int unused\nfunctionEnd'];
		for (let depth = 1; depth <= 15; depth++) {
			functions.push(`function fold${depth}
call fold${depth - 1}
call fold${depth - 1}
functionEnd`);
		}
		const project = parseProjectSource(`8f4e/v1
${functions.join('\n\n')}

function run
#export
call fold15
functionEnd`);
		const functionInlining = { maxCallerGrowth: 0 };
		const result = await compileProject(project, { functionInlining });
		const unpruned = await compileProject(project, { functionInlining, enableWasmPruning: false });
		expect(result.codeBuffer.length).toBeLessThan(210);
		expect(unpruned.codeBuffer.length).toBeGreaterThan(result.codeBuffer.length);

		const api = await wabt();
		const wasm = api.readWasm(new Uint8Array(result.codeBuffer), { threads: true });
		try {
			const text = wasm.toText({ foldExprs: false });
			expect(text).not.toMatch(/\(local\s|\bcall\s/);
		} finally {
			wasm.destroy();
		}
	});
});
