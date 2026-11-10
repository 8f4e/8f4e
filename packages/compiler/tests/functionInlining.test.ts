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
	it('inlines repeated calls with fresh source and scratch locals inside a loop', async () => {
		const project = parseProjectSource(`8f4e/v1
function subtract
param int left
param int right
local int previous
push previous
push left
sub right
abs
add
push 9
localSet previous
functionEnd int

function run
#export
local int previous
loop 3
push previous
call subtract 2 7
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
		expect(await countCalls(result)).toBe((await countCalls(baseline)) - 4);
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

	it('preserves the caller stack when inlining a lowered clearStack', async () => {
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
		expect(await countCalls(result)).toBe(0);
		expect(getExportedFunction(await instantiate(result), 'run')()).toBe(109);
	});

	it('inlines bodies with lowered string and address constants', async () => {
		const project = parseProjectSource(`8f4e/v1
function text
push "A"
drop
functionEnd

function address
#impure
push &source:
drop
functionEnd

function run
#export
call text
call address
functionEnd

entry main
module source
int value
moduleEnd
entryEnd`);
		const baseline = await compileProject(project, { enableFunctionInlining: false });
		const result = await compileProject(project);
		expect(await countCalls(result)).toBeLessThan(await countCalls(baseline));
		getExportedFunction(await instantiate(result), 'run')();
	});

	it('applies configurable expansion and caller growth limits', async () => {
		const project = parseProjectSource(`8f4e/v1
function leaf
push 7
add 1
functionEnd int

function run
#export
call leaf
call leaf
add
functionEnd int`);
		const cases = [
			{ functionInlining: {}, remainingCalls: 0 },
			{ functionInlining: { maxExpansionOperations: 2 }, remainingCalls: 2 },
			{ functionInlining: { maxCallerGrowth: 2 }, remainingCalls: 1 },
		];
		for (const { functionInlining, remainingCalls } of cases) {
			const result = await compileProject(project, { functionInlining });
			expect(await countCalls(result)).toBe(remainingCalls);
			expect(getExportedFunction(await instantiate(result), 'run')()).toBe(16);
		}
	});

	it('bounds growth when each inlining round exposes more multi-use callees', async () => {
		const depth = 15;
		const functions = ['function fold0\npush 1\nfunctionEnd int'];
		for (let index = 1; index <= depth; index++) {
			functions.push(`function fold${index}
call fold${index - 1}
call fold${index - 1}
add
functionEnd int`);
		}
		const project = parseProjectSource(`8f4e/v1
${functions.join('\n\n')}

function run
#export
call fold${depth}
functionEnd int`);
		const baseline = await compileProject(project, { enableFunctionInlining: false });
		const optimized = await compileProject(project);

		expect(optimized.codeBuffer.length).toBeLessThan(baseline.codeBuffer.length * 4);
		expect(await countCalls(optimized)).toBeLessThan(await countCalls(baseline));
		expect(getExportedFunction(await instantiate(optimized), 'run')()).toBe(2 ** depth);
	});

	it('folds nested dispatchers in execution order and skips disabled cycles', async () => {
		const project = parseProjectSource(`8f4e/v1
entry main
module first
push 1
assertEqual 1
moduleEnd
group voice
entry main
module second
push 2
assertEqual 2
moduleEnd
module skipped
#skipExecution
push 99
assertEqual 99
moduleEnd
entryEnd
groupEnd
module third
push 3
assertEqual 3
moduleEnd
entryEnd`);
		const result = await compileProject(project, { enableAssertions: true });
		const assertEqualI32 = vi.fn();
		getExportedFunction(await instantiate(result, { assertEqualI32 }), 'main')();
		expect(assertEqualI32.mock.calls.map(([actual]) => actual)).toEqual([1, 2, 3]);
		expect(await countCalls(result)).toBe(3);
	});

	it('returns from an inlined callee without returning from the caller', async () => {
		const project = parseProjectSource(`8f4e/v1
function select
param int condition
push condition
if
push 7
return
ifEnd
push 9
functionEnd int

function run
#export
param int condition
push 100
call select condition
add
functionEnd int`);
		const result = await compileProject(project);
		expect(await countCalls(result)).toBe(0);
		const run = getExportedFunction(await instantiate(result), 'run');
		expect(run(1)).toBe(107);
		expect(run(0)).toBe(109);
	});

	it('keeps calls that would exceed the Wasm local slot limit', async () => {
		const project = parseProjectSource(`8f4e/v1
function heavy
${Array.from({ length: 63 }, (_, index) => `local int heavy${index}`).join('\n')}
push -7
abs
drop
functionEnd

function light
local int value
functionEnd

function run
#export
param int value
${Array.from({ length: 14 }, (_, index) => `local int caller${index}`).join('\n')}
push value
abs
drop
${'call heavy\n'.repeat(782)}call light
functionEnd`);
		const baseline = await compileProject(project, { enableFunctionInlining: false });
		expect(WebAssembly.validate(new Uint8Array(baseline.codeBuffer))).toBe(true);

		const result = await compileProject(project, {
			enableWasmPruning: false,
			functionInlining: { maxCallerGrowth: Infinity },
		});
		expect(WebAssembly.validate(new Uint8Array(result.codeBuffer))).toBe(true);
		expect(await countCalls(result)).toBe(2);
		const run = result.compiledFunctions![createFunctionId('run', ['int'])];
		expect(run.locals.length + run.signature.parameters.length).toBe(50_000);
	});
});
