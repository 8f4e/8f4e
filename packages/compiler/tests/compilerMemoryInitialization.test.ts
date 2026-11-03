import { describe, expect, test } from 'vitest';
import wabt from 'wabt';

import { compileFixtureProgramSource, getExportedFunction, instantiateFixtureProgramSource } from './testUtils';

async function compileToWat(codeBuffer: Uint8Array): Promise<string> {
	const wabtApi = await wabt();
	const module = wabtApi.readWasm(codeBuffer, {});
	return module.toText({});
}

describe('compiler memory initialization', () => {
	test.each(
		[
			{ instruction: 'int[]', value: 7, View: Int32Array },
			{ instruction: 'int32[]', value: 7, View: Int32Array },
			{ instruction: 'int8[]', value: -7, View: Int8Array },
			{ instruction: 'int8u[]', value: 249, View: Uint8Array },
			{ instruction: 'int16[]', value: -12345, View: Int16Array },
			{ instruction: 'int16u[]', value: 54321, View: Uint16Array },
			{ instruction: 'float[]', value: 1.25, View: Float32Array },
			{ instruction: 'float64[]', value: 1.25, View: Float64Array },
		].flatMap(({ instruction, value, View }) => [
			{ instruction, initializer: String(value), expected: value, View },
			{ instruction, initializer: '0', expected: 0, View },
			{ instruction, initializer: '', expected: 0, View },
		])
	)(
		'initializes and resets one-element $instruction with initializer "$initializer"',
		async ({ instruction, initializer, expected, View }) => {
			const fixture = await instantiateFixtureProgramSource(`
8f4e/v1
entry main
module singleElementArray
${instruction} values 1 ${initializer}
moduleEnd
entryEnd
`);
			const declaration = fixture.compileResult.memoryPlan.modules.singleElementArray!.memory.values!;
			const values = new View((fixture.host.memory as WebAssembly.Memory).buffer, declaration.byteAddress, 1);
			const initDefaults = getExportedFunction(fixture.instance.exports, 'initDefaults');

			initDefaults();
			expect(values[0]).toBe(expected);

			values[0] = 99;
			expect(values[0]).toBe(99);
			initDefaults();
			expect(values[0]).toBe(expected);
		}
	);

	test.each([
		'',
		`entry main
module first
int value 1
moduleEnd
module second
float value 2.0
moduleEnd
entryEnd`,
	])('imports exactly one host memory for any module count', async source => {
		const { compileResult } = await compileFixtureProgramSource(`8f4e/v1
${source}`);
		const module = await WebAssembly.compile(new Uint8Array(compileResult.codeBuffer));
		expect(WebAssembly.Module.imports(module).filter(item => item.kind === 'memory')).toEqual([
			{ module: 'host', name: 'memory', kind: 'memory' },
		]);
	});

	test('allows repeated initDefaults calls to verify reset behavior after mutation', async () => {
		const fixture = await instantiateFixtureProgramSource(`
8f4e/v1

entry main
module resettableDefaults
int[] scratch 4
int marker 123

push &scratch
push 99
store

push &marker
push 456
store
moduleEnd
entryEnd
`);
		const memory = new Int32Array((fixture.host.memory as WebAssembly.Memory).buffer);
		const plannedModule = fixture.compileResult.memoryPlan.modules.resettableDefaults!;
		const scratch = plannedModule.memory.scratch!;
		const marker = plannedModule.memory.marker!;
		const initDefaults = getExportedFunction(fixture.instance.exports, 'initDefaults');
		const main = getExportedFunction(fixture.instance.exports, 'main');

		initDefaults();
		expect(memory[scratch.allocationUnitAddress]).toBe(0);
		expect(memory[marker.allocationUnitAddress]).toBe(123);

		main();
		expect(memory[scratch.allocationUnitAddress]).toBe(99);
		expect(memory[marker.allocationUnitAddress]).toBe(456);

		initDefaults();
		expect(memory[scratch.allocationUnitAddress]).toBe(0);
		expect(memory[marker.allocationUnitAddress]).toBe(123);
	});

	test('keeps sparse array initializers compact in the emitted wasm', async () => {
		const { compileResult } = await compileFixtureProgramSource(`
8f4e/v1

entry main
module hugeSparseArray
int[] huge 1000000 1
moduleEnd
entryEnd
`);

		expect(compileResult.codeBuffer.byteLength).toBeLessThan(10_000);
	});

	test('emits memory.fill before loading passive data defaults', async () => {
		const { compileResult } = await compileFixtureProgramSource(`
8f4e/v1

entry main
module memoryInitializationOrder
int implicitZero
int explicitValue 5
int[] implicitArray 4
moduleEnd
entryEnd
`);
		const wat = await compileToWat(compileResult.codeBuffer);
		const fillIndex = wat.indexOf('memory.fill');
		const memoryInitIndex = wat.indexOf('memory.init');

		expect(fillIndex).toBeGreaterThan(-1);
		expect(memoryInitIndex).toBeGreaterThan(-1);
		expect(fillIndex).toBeLessThan(memoryInitIndex);
		expect(wat.match(/memory\.fill/g)).toHaveLength(1);
		expect(wat).toContain(`i32.const ${compileResult.requiredMemoryBytes}`);
	});
});
