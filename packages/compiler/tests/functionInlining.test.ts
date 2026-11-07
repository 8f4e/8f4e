import type { CompileOptions, CompileResult } from '@8f4e/language-spec';
import { createFunctionId } from '@8f4e/language-spec';
import { describe, expect, it, vi } from 'vitest';
import wabtFactory from 'wabt';
import { compileProject, parseProjectSource } from '../src';
import { createMemory, getExportedFunction } from './testUtils';

function compile(source: string, options: CompileOptions = { inlineFunctions: true }) {
	return compileProject(parseProjectSource(`8f4e/v1\n${source}`), options);
}

async function instantiate(result: CompileResult, callbacks: Record<string, CallableFunction> = {}) {
	const memory = createMemory(result.requiredMemoryBytes);
	const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), {
		host: { memory, ...callbacks },
	});
	return { memory, exports: instance.exports };
}

async function callCount(result: CompileResult) {
	const wabt = await wabtFactory();
	const module = wabt.readWasm(new Uint8Array(result.codeBuffer), { threads: true });
	try {
		return (module.toText({ foldExprs: false }).match(/\bcall\s/g) ?? []).length;
	} finally {
		module.destroy();
	}
}

describe('function inlining', () => {
	it('is opt-in, removes calls, preserves exports and source metadata, and respects zero budgets', async () => {
		const project = parseProjectSource(`8f4e/v1
function value
#export original
push 7
functionEnd int
function caller
#export
call value
functionEnd int`);
		const baseline = await compileProject(project, { includeStackAnalysis: true });
		const optimized = await compileProject(project, {
			inlineFunctions: true,
			includeStackAnalysis: true,
			cache: baseline.cache,
		});
		expect((await compileProject(project, { inlineFunctions: false })).codeBuffer).toEqual(baseline.codeBuffer);
		for (const inlineFunctions of [{ maxCalleeOperations: 0 }, { maxCallerOperations: 0 }]) {
			expect((await compileProject(project, { inlineFunctions })).codeBuffer).toEqual(baseline.codeBuffer);
		}
		expect(await callCount(baseline)).toBe(1);
		expect(await callCount(optimized)).toBe(0);
		const runtime = await instantiate(optimized);
		expect(getExportedFunction(runtime.exports, 'caller')()).toBe(7);
		expect(getExportedFunction(runtime.exports, 'original')()).toBe(7);
		for (const [id, fn] of Object.entries(baseline.compiledFunctions!)) {
			expect(optimized.compiledFunctions![id].wasmIndex).toBe(fn.wasmIndex);
			expect(optimized.compiledFunctions![id].ast).toEqual(fn.ast);
			expect(optimized.compiledFunctions![id].analysis).toEqual(fn.analysis);
			expect(optimized.compiledFunctions![id].stackAnalysis).toEqual(fn.stackAnalysis);
		}
	});

	it('evaluates arguments once and preserves argument order and pending caller operands', async () => {
		const result = await compile(`function next
#import next
functionEnd int
function subtract
param int left
param int right
push left
push right
sub
functionEnd int
function caller
#export
push 100
call next
call next
call subtract
add
functionEnd int`);
		let counter = 0;
		const next = vi.fn(() => ++counter);
		const runtime = await instantiate(result, { next });
		expect(getExportedFunction(runtime.exports, 'caller')()).toBe(99);
		expect(next).toHaveBeenCalledTimes(2);
	});

	it.each([0, 128])('preserves mixed multi-value results with %i preceding signature types', async precedingTypes => {
		const prefix = Array.from({ length: precedingTypes }, (_, index) =>
			[
				`function unused${index}`,
				...Array.from({ length: 8 }, (_, bit) => `param ${index & (1 << bit) ? 'float' : 'int'} p${bit}`),
				'functionEnd',
			].join('\n')
		).join('\n');
		const result = await compile(`${prefix}
function mixed
param int integer
param float single
param float64 wide
push integer
push single
push wide
functionEnd int float float64
function caller
#export
push 100
call mixed 7 1.25 2.5f64
functionEnd int int float float64`);
		const runtime = await instantiate(result);
		expect(getExportedFunction(runtime.exports, 'caller')()).toEqual([100, 7, 1.25, 2.5]);
	});

	it('resets source locals for loop invocations and isolates caller/callee loop storage', async () => {
		const result = await compile(
			`function fresh
local int value
local float single
local float64 wide
push value
push single
push wide
loop 1
push 1
localSet value
push 1.0
localSet single
push 1.0f64
localSet wide
loopEnd
functionEnd int float float64
function caller
#export
local int value
loop 3
call fresh
assertEqual 0.0f64
assertEqual 0.0
push value
add
localSet value
loopEnd
loop 1
loopEnd
push value
functionEnd int`,
			{ inlineFunctions: true, enableAssertions: true }
		);
		const single = vi.fn();
		const wide = vi.fn();
		const runtime = await instantiate(result, { assertEqualF32: single, assertEqualF64: wide });
		expect(getExportedFunction(runtime.exports, 'caller')()).toBe(0);
		expect(single).toHaveBeenCalledTimes(3);
		expect(wide).toHaveBeenCalledTimes(3);
		for (const callback of [single, wide])
			expect(callback.mock.calls.every(([actual, expected]) => actual === 0 && expected === 0)).toBe(true);
	});

	it('keeps branches to the implicit function label inside the inline scope', async () => {
		const result = await compile(`function forbidden
#import forbidden
functionEnd
function record
#import record
functionEnd
function escape
branch 0
call forbidden
functionEnd
function caller
#export
call escape
call record
functionEnd`);
		const forbidden = vi.fn();
		const record = vi.fn();
		const runtime = await instantiate(result, { forbidden, record });
		getExportedFunction(runtime.exports, 'caller')();
		expect(forbidden).not.toHaveBeenCalled();
		expect(record).toHaveBeenCalledTimes(1);
	});

	it('strips a final void return while leaving early-return functions as calls', async () => {
		const result = await compile(`function finish
return
functionEnd
function early
param int value
push value
if
push 7
return
ifEnd
push 9
functionEnd int
function caller
#export
call finish
call early 1
functionEnd int`);
		expect(await callCount(result)).toBe(1);
		const runtime = await instantiate(result);
		expect(getExportedFunction(runtime.exports, 'caller')()).toBe(7);
	});

	it('expands one level and leaves calls inside copied bodies intact', async () => {
		const result = await compile(`function leaf
push 7
functionEnd int
function middle
call leaf
functionEnd int
function outer
#export
call middle
functionEnd int`);
		expect(await callCount(result)).toBe(1);
		const runtime = await instantiate(result);
		expect(getExportedFunction(runtime.exports, 'outer')()).toBe(7);
	});

	it.each([false, true])(
		'preserves assertion sites and source bindings with assertions enabled=%s',
		async enableAssertions => {
			const source = `function checked
param int value
push value
assertEqual 7
functionEnd
function caller
#export
call checked 7
call checked 8
push 5
assertEqual 5
functionEnd`;
			const baseline = await compile(source, { enableAssertions });
			const optimized = await compile(source, { inlineFunctions: true, enableAssertions });
			const originalCallback = vi.fn();
			const inlinedCallback = vi.fn();
			const original = await instantiate(baseline, { assertEqualI32: originalCallback });
			const inlined = await instantiate(optimized, { assertEqualI32: inlinedCallback });
			getExportedFunction(original.exports, 'caller')();
			getExportedFunction(inlined.exports, 'caller')();
			expect(inlinedCallback.mock.calls).toEqual(originalCallback.mock.calls);
			expect(optimized.assertionSites).toEqual(baseline.assertionSites);
		}
	);

	it('inlines overloaded pointer functions in module bodies without changing memory layout', async () => {
		const source = `function read
#impure
param int* address
push *address
functionEnd int
function read
#impure
param float* address
push *address
functionEnd float
entry main
module values
int input 7
float factor 1.25
int output
float single
push &output
call read &input
store
push &single
call read &factor
store
moduleEnd
entryEnd`;
		const baseline = await compile(source, {});
		const optimized = await compile(source);
		expect(optimized.memoryPlan).toEqual(baseline.memoryPlan);
		const runtime = await instantiate(optimized);
		getExportedFunction(runtime.exports, 'initDefaults')();
		getExportedFunction(runtime.exports, 'main')();
		const memory = new DataView(runtime.memory.buffer);
		const values = optimized.memoryPlan.modules.values.memory;
		expect(memory.getInt32(values.output.byteAddress, true)).toBe(7);
		expect(memory.getFloat32(values.single.byteAddress, true)).toBe(1.25);
		expect(optimized.compiledFunctions![createFunctionId('read', ['int*'])].analysis.isImported).toBe(false);
	});
});
