import { type CompileResult, createFunctionId } from '@8f4e/language-spec';
import { describe, expect, it, vi } from 'vitest';
import wabt from 'wabt';
import { compileProject, parseProjectSource } from '../src';
import { createMemory, getExportedFunction } from './testUtils';

async function instantiate(result: CompileResult, callbacks: Record<string, CallableFunction> = {}) {
	const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), {
		host: { memory: createMemory(result.requiredMemoryBytes), ...callbacks },
	});
	return instance.exports;
}

async function countCalls(result: CompileResult) {
	const api = await wabt();
	const module = api.readWasm(new Uint8Array(result.codeBuffer), { threads: true });
	try {
		return (module.toText({ foldExprs: false }).match(/\bcall\s/g) ?? []).length;
	} finally {
		module.destroy();
	}
}

describe('function inlining', () => {
	it('removes eligible calls by default, including repeated calls with fresh locals inside a loop', async () => {
		const project = parseProjectSource(`8f4e/v1
function subtract
param int left
param int right
local int previous
push previous
push left
sub right
add
push 9
localSet previous
functionEnd int

function run
#export
local int previous
loop 3
push previous
call subtract 7 2
add
call subtract 4 1
add
localSet previous
loopEnd
push previous
assertEqual 24
push previous
functionEnd int`);
		const options = { enableAssertions: true, includeStackAnalysis: true };
		const optimized = await compileProject(project, options);
		const baseline = await compileProject(project, {
			...options,
			enableFunctionInlining: false,
			cache: optimized.cache,
		});

		expect(await countCalls(optimized)).toBe((await countCalls(baseline)) - 2);
		const runId = createFunctionId('run', []);
		const originalRun = baseline.compiledFunctions![runId];
		const optimizedRun = optimized.compiledFunctions![runId];
		expect(optimizedRun.ast).toEqual(originalRun.ast);
		expect(optimizedRun.stackAnalysis).toEqual(originalRun.stackAnalysis);
		expect(optimized.assertionSites).toEqual(baseline.assertionSites);
		for (const result of [optimized, baseline]) {
			const assertEqualI32 = vi.fn();
			const exports = await instantiate(result, { assertEqualI32 });
			expect(getExportedFunction(exports, 'run')()).toBe(24);
			expect(assertEqualI32.mock.calls).toEqual([[24, 24, 0]]);
		}
	});

	it('uses the resolved overload in a module and preserves an inlined function export', async () => {
		const project = parseProjectSource(`8f4e/v1
function double
param int value
push value
mul 2
functionEnd int

function double
param float64 value
push value
mul 2.0f64
functionEnd float64

function increment
#export
param float64 value
push value
add 1.0f64
functionEnd float64

entry main
module checks
call double 4
assertEqual 8
call double 1.25f64
assertEqual 2.5f64
call increment 2.5f64
assertEqual 3.5f64
moduleEnd
entryEnd`);
		const result = await compileProject(project, { enableAssertions: true });
		const baseline = await compileProject(project, { enableAssertions: true, enableFunctionInlining: false });
		expect(await countCalls(result)).toBe((await countCalls(baseline)) - 3);
		const assertEqualI32 = vi.fn();
		const assertEqualF64 = vi.fn();
		const exports = await instantiate(result, { assertEqualI32, assertEqualF64 });
		getExportedFunction(exports, 'main')();
		expect(assertEqualI32.mock.calls).toEqual([[8, 8, 0]]);
		expect(assertEqualF64.mock.calls).toEqual([
			[2.5, 2.5, 1],
			[3.5, 3.5, 2],
		]);
		expect(getExportedFunction(exports, 'increment')(2.5)).toBe(3.5);
	});

	it('retains calls to functions with whole-stack effects', async () => {
		const project = parseProjectSource(`8f4e/v1
function clear
push 7
clearStack
push 9
functionEnd int

function run
#export
push 100
call clear
add
functionEnd int`);
		const result = await compileProject(project);
		expect(await countCalls(result)).toBe(1);
		expect(getExportedFunction(await instantiate(result), 'run')()).toBe(109);
	});
});
