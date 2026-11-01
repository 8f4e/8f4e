import { formatTestFailures, runTests } from '@8f4e/test-runner';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';
import { runFixtureProgramFile } from './testUtils';

describe('shared test runner', () => {
	it('reports original sites for scalar and pointer overloads, skipped branches, loops, and helper functions', async () => {
		const original = parseProjectSource(`8f4e/v1
entry test
module assertions
int value 7
push 1
push 2
add
assertEqual 3
push 9
assertEqual 10
push &value
assertEqual &value
push 3.14
assertEqual 3.14
push 2.5f64
assertEqual 2.5f64
push 0
if
push 99
assertEqual 99
ifEnd
loop 2
push 7
assertEqual 8
loopEnd
call helper
moduleEnd
entryEnd
function helper
push 5
assertEqual 5
functionEnd`);
		const saved = structuredClone(original);
		const compiled = await compileProject(original, { enableAssertions: true, disableSharedMemory: true });
		const result = await runTests(compiled);
		const assertionSites = compiled.assertionSites!;
		const { assertions: events } = result;
		expect(original).toEqual(saved);
		expect(result.assertions.length).toBe(8);
		expect(result.failures.map(failure => failure.site.siteId)).toEqual([1, 6, 6]);
		expect(result.failures.map(failure => failure.assertIndex)).toEqual([1, 5, 6]);

		expect(assertionSites).toHaveLength(8);
		expect(events.map(event => event.site.siteId)).toEqual([0, 1, 2, 3, 4, 6, 6, 7]);
		expect(events.filter(event => !event.passed).map(event => event.site.siteId)).toEqual([1, 6, 6]);
		expect(events.find(event => event.site.siteId === 5)).toBeUndefined();
		for (const event of events) {
			const site = assertionSites[event.site.siteId];
			const block = [...original.modules, ...original.functions].find(block => block.id === site.projectBlockId)!;
			expect(block.code[site.lineNumber]).toMatch(/^assertEqual/);
		}
		expect(assertionSites[7]).toMatchObject({ codeBlockType: 'function', codeBlockId: 'helper', lineNumber: 2 });
		expect(formatTestFailures(result.failures)).toContain(
			'assertEqual #5 expected 8, received 7 at module assertions, block line 22 (site 6)'
		);
	});

	it('resolves assertions in isolated nested groups and distinguishes same-named blocks', async () => {
		const project = parseProjectSource(`8f4e/v1
entry test
group parent
module repeated
call helper
moduleEnd
function helper
push 1
assertEqual 2
functionEnd
group child
module repeated
push 3
assertEqual 4
moduleEnd
groupEnd
groupEnd
entryEnd`);
		const compiled = await compileProject(project, { enableAssertions: true, disableSharedMemory: true });
		const result = await runTests(compiled);
		expect(result.failures.map(failure => failure.site)).toMatchObject([
			{ projectGroupPath: 'parent/child', codeBlockId: 'repeated', lineNumber: 2, siteId: 0 },
			{ projectGroupPath: 'parent', codeBlockId: 'helper', codeBlockType: 'function', lineNumber: 2, siteId: 1 },
		]);
		expect(formatTestFailures(result.failures)).toContain('module parent/child/repeated, block line 3 (site 0)');
		expect(formatTestFailures(result.failures)).toContain('function parent/helper, block line 3 (site 1)');
	});

	it('executes exported test functions and reports NaN comparisons as failures', async () => {
		const project = parseProjectSource(`8f4e/v1
function test
#export
push -1.0
sqrt
assertEqual 0.0
functionEnd`);
		const compiled = await compileProject(project, { enableAssertions: true, disableSharedMemory: true });
		const result = await runTests(compiled);
		expect(result.assertions.length).toBe(1);
		expect(result.failures).toMatchObject([
			{ received: Number.NaN, passed: false, site: { codeBlockType: 'function', codeBlockId: 'test', lineNumber: 4 } },
		]);
	});

	it('reports source sites through the compiler fixture adapter', async () => {
		const directory = await fs.mkdtemp(path.join(tmpdir(), '8f4e-assertion-'));
		const filePath = path.join(directory, 'failing.8f4e');
		try {
			await fs.writeFile(
				filePath,
				`8f4e/v1
entry test
module failure
push 3
assertEqual 4
moduleEnd
entryEnd`
			);
			await expect(runFixtureProgramFile(filePath)).rejects.toThrow(
				'failing.8f4e: 1 assertion failed:\n  assertEqual #0 expected 4, received 3 at module failure, block line 3 (site 0)'
			);
		} finally {
			await fs.rm(directory, { recursive: true, force: true });
		}
	});
});

describe('native assertion source reporting', () => {
	it('reports assertions from included helpers with physical source lines', async () => {
		const included = [
			'function verify',
			'#export',
			'; source comment',
			'push',
			'- 0',
			'assert',
			'push 3',
			'assertEqual',
			'- 4',
			'functionEnd',
		].join('\n');
		const compiled = await compileProject(
			parseProjectSource(`8f4e/v1
includes
include tests/verify
includesEnd
entry test
module driver
call verify
moduleEnd
entryEnd`),
			{
				enableAssertions: true,
				disableSharedMemory: true,
				resolveInclude: () => included,
			}
		);
		const result = await runTests(compiled);
		expect(result.failures).toHaveLength(2);
		expect(compiled.assertionSites!.map(site => site.lineNumber)).toEqual([5, 7]);
		expect(result.failures[0].site.source).toEqual({
			kind: 'include',
			includeId: 'tests/verify',
			symbolName: 'verify',
		});
		expect(formatTestFailures(result.failures)).toContain('include tests/verify (verify)');
	});

	it('requires compilation with native assertions enabled', async () => {
		const project = parseProjectSource(`8f4e/v1
entry test
module check
push 1
assert
moduleEnd
entryEnd`);
		const compiled = await compileProject(project, { disableSharedMemory: true });
		await expect(runTests(compiled)).rejects.toThrow('enableAssertions: true');
	});
});

it('initializes fresh memory once per project run and executes only the test entry', async () => {
	const project = parseProjectSource(`8f4e/v1
entry init
module resetCounter
push &counter:value
push 99
store
moduleEnd
entryEnd
entry test
module counter
int value 7
push value
assertEqual 7
push &value
push 11
store
moduleEnd
entryEnd`);
	const compiled = await compileProject(project, { enableAssertions: true, disableSharedMemory: true });
	const first = await runTests(compiled);
	const second = await runTests(compiled);
	const address = compiled.memoryPlan.modules.counter.memory.value.allocationUnitAddress;
	expect(first.failures).toHaveLength(0);
	expect(second.failures).toHaveLength(0);
	expect(first.assertions.length).toBe(1);
	expect(first.memory).not.toBe(second.memory);
	expect(new Int32Array(first.memory.buffer)[address]).toBe(11);
	const borrowed = await runTests({
		codeBuffer: compiled.codeBuffer,
		assertionSites: compiled.assertionSites,
		memory: first.memory,
	});
	expect(borrowed.memory).toBe(first.memory);
	expect(borrowed.failures).toMatchObject([{ received: 11, expected: 7 }]);
});

it('collects integer truth and exact numeric equality through the compiled Wasm callbacks', async () => {
	const compiled = await compileProject(
		parseProjectSource(`8f4e/v1
entry test
module checks
push 0
assert
push -1
assert
push -1
assertEqual -1
push 1.0
assertEqual 1.0001
local float64 nan
push -1.0f64
sqrt
localSet nan
push nan
assertEqual nan
push 1e40
assertEqual 1e40
push -0.0
assertEqual 0.0
push 1.0f64
assertEqual 1.0001f64
push 0
if
push 0
assert
ifEnd
moduleEnd
entryEnd`),
		{ enableAssertions: true, disableSharedMemory: true }
	);
	const result = await runTests(compiled);
	expect(result.assertions.map(assertion => assertion.passed)).toEqual([
		false,
		true,
		true,
		false,
		false,
		true,
		true,
		false,
	]);
	expect(result.assertions.map(assertion => assertion.assertIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
	expect(result.failures).toHaveLength(4);
	expect(result.assertions[4]).toMatchObject({ received: Number.NaN, expected: Number.NaN });
	expect(result.assertions[5]).toMatchObject({ received: Infinity, expected: Infinity });
	expect(result.assertions[6]).toMatchObject({ received: -0, expected: 0 });
	expect(compiled.assertionSites).toHaveLength(9);
	expect(result.assertions.some(assertion => assertion.site.siteId === 8)).toBe(false);
	expect(formatTestFailures(result.failures)).toContain('assert #0 expected nonzero, received 0');
});
