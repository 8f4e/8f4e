import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { IGNORED_ASSERTION_IMPORTS } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { executeTests } from './executeTests';

describe('test runtime execution', () => {
	it('runs once against initialized shared editor memory, preserving changes and assertion sites', async () => {
		const compiled = await compileProject(
			parseProjectSource(`8f4e/v1
entry test
module checks
int count 5
push count
assertEqual 9
push &count
push count
push 1
add
store
push 1
assert
moduleEnd
entryEnd`),
			{ enableAssertions: true }
		);
		const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
		const { instance } = await WebAssembly.instantiate(new Uint8Array(compiled.codeBuffer), {
			host: { memory, ...IGNORED_ASSERTION_IMPORTS },
		});
		(instance.exports.initDefaults as CallableFunction)();
		const view = new Int32Array(memory.buffer);
		const address = compiled.memoryPlan.modules.checks.memory.count.byteAddress / 4;
		view[address] = 9;

		const program = { codeBuffer: compiled.codeBuffer, assertionSites: compiled.assertionSites!, memory };
		const first = await executeTests(program);
		expect(first).toMatchObject({
			status: 'passed',
			assertions: [{ passed: true }, { passed: true }],
			failures: [],
		});
		expect(view[address]).toBe(10);

		const second = await executeTests(program);
		expect(second).toMatchObject({
			status: 'failed',
			assertions: [{ received: 10, expected: 9, passed: false }, { passed: true }],
			failures: [{ site: compiled.assertionSites![0] }],
		});
		expect(view[address]).toBe(11);
	});

	it('reports Wasm traps as runtime errors', async () => {
		const compiled = await compileProject(
			parseProjectSource(`8f4e/v1
entry test
module trap
push -2147483648
push -1
div
drop
moduleEnd
entryEnd`),
			{ enableAssertions: true }
		);
		const result = await executeTests({
			codeBuffer: compiled.codeBuffer,
			assertionSites: compiled.assertionSites!,
			memory: new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true }),
		});
		expect(result).toMatchObject({
			status: 'error',
			error: expect.stringMatching(/overflow|unrepresentable/),
		});
	});
});
