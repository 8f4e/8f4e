import { createProjectObjectModel, type ProjectObjectModel } from '@8f4e/language-spec';
import { composeProgram } from '@8f4e/program-composer/internal';
import { emitWasmProgram } from '@8f4e/wasm-codegen';
import { describe, expect, it } from 'vitest';
import { compileSubProgram } from '.';

// The same lowering paths run in both module and function emitters.
const body = `local int total
push -7
abs
assertEqual 7
push -8
abs
assertEqual 8
push 0
ensureNonZero
assertEqual 1
push 0.0
ensureNonZero
assertEqual 1.0
push 0.0f64
ensureNonZero
assertEqual 1.0f64
push 7
push 3
min
assertEqual 3
push 4
push 2
min
assertEqual 2
push 7
push 3
max
assertEqual 7
push 4
push 2
max
assertEqual 4
push 1
mapBegin int
map 1 2.5f64
mapEnd float64
assertEqual 2.5f64
push 1.0f64
mapBegin float64
map 1.0f64 3.5
mapEnd float
assertEqual 3.5
loop 2
loop 3
push total
push 1
add
localSet total
loopEnd
loopEnd
push total
assertEqual 6
push address
push 42
store
push address
load
assertEqual 42
push address
push 1.5
store
push address
loadFloat
assertEqual 1.5
push address
push 2.5f64
store
push 11
push 22
push address
storeBytes 2
push address
load8u
assertEqual 22
push address
push address
memoryCopy 4
push address
push address
memoryCopy 4
push address
clampGlobalAddress
drop
push address
clampGlobalAddress
drop
push 1
assert`.split('\n');

function compile(lineNumber?: (index: number) => number, enableAssertions = true) {
	const project: ProjectObjectModel = {
		...createProjectObjectModel(),
		entries: ['main'],
		execution: [
			{ type: 'module', id: 1, entry: 'main', code: ['module checks', 'local int address', ...body, 'moduleEnd'] },
		],
		functions: [
			{
				type: 'function',
				id: 2,
				code: [
					'function helper',
					'#export',
					'#impure',
					'param int address',
					'param int** pointer',
					...body,
					'push **pointer',
					'assertEqual 99',
					'push **pointer',
					'assertEqual 99',
					'functionEnd',
				],
			},
		],
	};
	const program = composeProgram(project);
	if (lineNumber) {
		for (const ast of [...program.ast.modules, ...program.ast.functions]) {
			ast.lines.forEach((line, index) => {
				line.lineNumber = lineNumber(index);
			});
		}
	}
	return emitWasmProgram(compileSubProgram(program, { enableAssertions }));
}

describe('source provenance in codegen', () => {
	it.each([false, true])('emits identical Wasm and locals after renumbering with assertions enabled=%s', enabled => {
		const original = compile(undefined, enabled);
		for (const numbering of [() => 7, (index: number) => 1000 - index * 3]) {
			const changed = compile(numbering, enabled);
			expect(changed.codeBuffer).toEqual(original.codeBuffer);
			expect(WebAssembly.validate(new Uint8Array(changed.codeBuffer))).toBe(true);
			expect(Object.values(changed.compiledFunctions!).map(func => func.locals)).toEqual(
				Object.values(original.compiledFunctions!).map(func => func.locals)
			);
		}
	});

	it('executes distinct typed locals and assertion sites even when all source locations coincide', async () => {
		const original = compile();
		const repeated = compile(() => 7);
		expect(repeated.assertionSites).toEqual(original.assertionSites!.map(site => ({ ...site, lineNumber: 7 })));
		const calls: Array<{ siteId: number; received: number; expected: number }> = [];
		const equal = (received: number, expected: number, siteId: number) => calls.push({ siteId, received, expected });
		const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
		const { instance } = await WebAssembly.instantiate(new Uint8Array(repeated.codeBuffer), {
			host: {
				memory,
				assertEqualI32: equal,
				assertEqualF32: equal,
				assertEqualF64: equal,
				assertCondition: (received: number, siteId: number) => equal(received, 1, siteId),
			},
		});
		const words = new Int32Array(memory.buffer);
		words[8] = 40;
		words[10] = 99;
		(instance.exports.main as CallableFunction)();
		(instance.exports.helper as CallableFunction)(0, 32);
		expect(calls.map(call => call.siteId)).toEqual(repeated.assertionSites!.map(site => site.siteId));
		for (const call of calls) expect(call.received).toBe(call.expected);
		expect(original.assertionSites!.some(site => site.lineNumber !== 7)).toBe(true);
	});
});
