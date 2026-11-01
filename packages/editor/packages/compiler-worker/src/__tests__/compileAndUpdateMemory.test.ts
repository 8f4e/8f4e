import type { CompileAndUpdateMemoryResult, ProjectObjectModel } from '@8f4e/language-spec';
import { getProjectModules } from '@8f4e/language-spec';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type compileAndUpdateMemoryType from '../compileAndUpdateMemory';

const compilerOptions = { startingMemoryAllocationUnitAddress: 1 };
let compileAndUpdateMemory: typeof compileAndUpdateMemoryType;

const createInput = (modules: Array<{ code: string[] }>, entry = 'main'): ProjectObjectModel => ({
	code: [],
	execution: [...modules.map((module, id) => ({ ...module, type: 'module' as const, id, entry }))],
	constants: [],
	functions: [],
	prototypes: [],
	includes: [],
	notes: [],
	unknown: [],
});

beforeEach(async () => {
	vi.resetModules();
	({ default: compileAndUpdateMemory } = await import('../compileAndUpdateMemory'));
});

describe('compileAndUpdateMemory execution entries', () => {
	const createModules = (baseDefault: number): Array<{ code: string[] }> => [
		{
			code: `
module setup
int base ${baseDefault}
int derived 0
push &derived
push &base
load
push 1
add
store
moduleEnd
`
				.trim()
				.split('\n'),
		},
	];

	const getAddresses = (result: CompileAndUpdateMemoryResult) => ({
		base: result.memoryPlan.modules.setup!.memory.base!.byteAddress / 4,
		derived: result.memoryPlan.modules.setup!.memory.derived!.byteAddress / 4,
	});

	it('initializes defaults without running execution entries', async () => {
		const firstResult = await compileAndUpdateMemory(createInput(createModules(1), 'init'), compilerOptions);
		const addresses = getAddresses(firstResult);
		const memoryView = new Int32Array(firstResult.memoryRef.buffer);

		const exportKeys = Object.keys(
			(
				await WebAssembly.instantiate(firstResult.codeBuffer, {
					host: { memory: new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true }) },
				})
			).instance.exports as Record<string, unknown>
		);

		expect(exportKeys).toContain('init');
		expect(firstResult.compiledModules.setup.executionEntryName).toBe('init');
		expect(firstResult.astCacheStats).toEqual({ hits: 0, misses: 1 });
		expect(memoryView[addresses.base]).toBe(1);
		expect(memoryView[addresses.derived]).toBe(0);

		const secondResult = await compileAndUpdateMemory(createInput(createModules(10), 'init'), compilerOptions);
		const updatedMemory = new Int32Array(secondResult.memoryRef.buffer);

		expect(secondResult.astCacheStats).toEqual({ hits: 0, misses: 2 });
		expect(updatedMemory[addresses.base]).toBe(10);
		expect(updatedMemory[addresses.derived]).toBe(0);
	});

	it('initializes a project with all assertion imports without running its test entry', async () => {
		const project = createInput([
			{
				code: `module checks
int ran 0
push 0
assert
push 1
assertEqual 2
push 1.0
assertEqual 2.0
push 1.0f64
assertEqual 2.0f64
push &ran
push 1
store
moduleEnd`.split('\n'),
			},
		]);
		getProjectModules(project)[0].entry = 'test';
		const result = await compileAndUpdateMemory(project, { ...compilerOptions, enableAssertions: true });
		const imports = WebAssembly.Module.imports(new WebAssembly.Module(new Uint8Array(result.codeBuffer)));
		expect(result.assertionSites).toMatchObject([
			{ instruction: 'assert', codeBlockId: 'checks', lineNumber: 3 },
			{ instruction: 'assertEqual', lineNumber: 5 },
			{ instruction: 'assertEqual', lineNumber: 7 },
			{ instruction: 'assertEqual', lineNumber: 9 },
		]);

		expect(imports.filter(item => item.kind === 'function').map(item => item.name)).toEqual([
			'assertCondition',
			'assertEqualI32',
			'assertEqualF32',
			'assertEqualF64',
		]);
		const address = result.memoryPlan.modules.checks.memory.ran.byteAddress / 4;
		expect(new Int32Array(result.memoryRef.buffer)[address]).toBe(0);
	});

	it('does not run execution entries when defaults are unchanged', async () => {
		const firstResult = await compileAndUpdateMemory(createInput(createModules(3), 'init'), compilerOptions);
		const addresses = getAddresses(firstResult);
		const memoryView = new Int32Array(firstResult.memoryRef.buffer);

		expect(memoryView[addresses.base]).toBe(3);
		expect(memoryView[addresses.derived]).toBe(0);

		memoryView[addresses.base] = 5;

		const secondResult = await compileAndUpdateMemory(createInput(createModules(3), 'init'), compilerOptions);
		const secondMemory = new Int32Array(secondResult.memoryRef.buffer);

		expect(secondResult.astCacheStats).toEqual({ hits: 1, misses: 1 });
		expect(secondMemory[addresses.base]).toBe(5);
		expect(secondMemory[addresses.derived]).toBe(0);
	});
});

describe('compileAndUpdateMemory float64 incremental patching', () => {
	it('patches float64 scalar default correctly on incremental recompile', async () => {
		const createModules = (val: number): Array<{ code: string[] }> => [
			{ code: `module mymod\nfloat64 value ${val}\nmoduleEnd`.split('\n') },
		];

		const firstResult = await compileAndUpdateMemory(createInput(createModules(1.5)), compilerOptions);
		const memEntry = firstResult.memoryPlan.modules.mymod!.memory.value!;
		const float64Index = memEntry.byteAddress / 8;
		const firstView = new Float64Array(firstResult.memoryRef.buffer);

		expect(firstView[float64Index]).toBeCloseTo(1.5);

		const secondResult = await compileAndUpdateMemory(createInput(createModules(2.5)), compilerOptions);
		const secondView = new Float64Array(secondResult.memoryRef.buffer);

		expect(secondView[float64Index]).toBeCloseTo(2.5);
	});

	it('does not overwrite float64 memory when default is unchanged on incremental recompile', async () => {
		const createModules = (val: number): Array<{ code: string[] }> => [
			{ code: `module mymod\nfloat64 value ${val}\nmoduleEnd`.split('\n') },
		];

		const firstResult = await compileAndUpdateMemory(createInput(createModules(3.14)), compilerOptions);
		const memEntry = firstResult.memoryPlan.modules.mymod!.memory.value!;
		const float64Index = memEntry.byteAddress / 8;

		const firstView = new Float64Array(firstResult.memoryRef.buffer);
		expect(firstView[float64Index]).toBeCloseTo(3.14);

		// Manually overwrite the value in memory
		firstView[float64Index] = 9.99;

		const secondResult = await compileAndUpdateMemory(createInput(createModules(3.14)), compilerOptions);
		const secondView = new Float64Array(secondResult.memoryRef.buffer);

		// Should NOT have been reset to 3.14 since the default didn't change
		expect(secondView[float64Index]).toBeCloseTo(9.99);
	});
});

describe('compileAndUpdateMemory narrow integer incremental patching', () => {
	const compileModule = async (declaration: string) => {
		const modules = [{ code: `module mymod\n${declaration}\nint marker 7\nmoduleEnd`.split('\n') }];

		return compileAndUpdateMemory(createInput(modules), compilerOptions);
	};

	const writeMarker = (result: CompileAndUpdateMemoryResult) => {
		const marker = result.memoryPlan.modules.mymod!.memory.marker!;
		new Int32Array(result.memoryRef.buffer)[marker.byteAddress / 4] = 1234;
		return marker;
	};

	const readMarker = (result: CompileAndUpdateMemoryResult, markerByteAddress: number) =>
		new Int32Array(result.memoryRef.buffer)[markerByteAddress / 4];

	it('patches int8 array defaults through a one-byte view', async () => {
		const first = await compileModule('int8[] values 4 1 2 3 4');
		const marker = writeMarker(first);

		const second = await compileModule('int8[] values 4 -7 -128 127 5');
		const values = second.memoryPlan.modules.mymod!.memory.values!;

		expect(second.memoryAction).toEqual({ action: 'reused' });
		expect(Array.from(new Uint8Array(second.memoryRef.buffer, values.byteAddress, values.elementByteLength))).toEqual([
			0xf9, 0x80, 0x7f, 0x05,
		]);
		expect(readMarker(second, marker.byteAddress)).toBe(1234);
	});

	it('patches int16 array defaults through a two-byte view', async () => {
		const first = await compileModule('int16[] values 4 1 2 3 4');
		const marker = writeMarker(first);

		const second = await compileModule('int16[] values 4 -12345 258 7 -2');
		const values = second.memoryPlan.modules.mymod!.memory.values!;

		expect(second.memoryAction).toEqual({ action: 'reused' });
		expect(Array.from(new Int16Array(second.memoryRef.buffer, values.byteAddress, values.numberOfElements))).toEqual([
			-12345, 258, 7, -2,
		]);
		expect(Array.from(new Uint8Array(second.memoryRef.buffer, values.byteAddress, values.elementByteLength))).toEqual([
			0xc7, 0xcf, 0x02, 0x01, 0x07, 0x00, 0xfe, 0xff,
		]);
		expect(readMarker(second, marker.byteAddress)).toBe(1234);
	});

	it('keeps the raw byte representation of unsigned narrow arrays', async () => {
		const createModules = (bytesInitializer: string, halvesInitializer: string) => [
			{
				code: `module mymod
int8u[] bytes 3 ${bytesInitializer}
int16u[] halves 3 ${halvesInitializer}
moduleEnd`.split('\n'),
			},
		];

		await compileAndUpdateMemory(createInput(createModules('1 2 3', '1 2 3')), compilerOptions);

		const second = await compileAndUpdateMemory(
			createInput(createModules('249 200 1', '54321 65535 1')),
			compilerOptions
		);
		const { bytes, halves } = second.memoryPlan.modules.mymod!.memory;

		expect(second.memoryAction).toEqual({ action: 'reused' });
		expect(Array.from(new Uint8Array(second.memoryRef.buffer, bytes!.byteAddress, bytes!.elementByteLength))).toEqual([
			0xf9, 0xc8, 0x01,
		]);
		expect(Array.from(new Uint8Array(second.memoryRef.buffer, halves!.byteAddress, halves!.elementByteLength))).toEqual(
			[0x31, 0xd4, 0xff, 0xff, 0x01, 0x00]
		);
		expect(Array.from(new Uint16Array(second.memoryRef.buffer, halves!.byteAddress, halves!.numberOfElements))).toEqual(
			[54321, 65535, 1]
		);
	});

	it('does not overwrite narrow array memory when defaults are unchanged', async () => {
		const first = await compileModule('int8[] values 4 1 2 3 4');

		const values = first.memoryPlan.modules.mymod!.memory.values!;
		const firstView = new Int8Array(first.memoryRef.buffer, values.byteAddress, values.numberOfElements);
		expect(Array.from(firstView)).toEqual([1, 2, 3, 4]);
		firstView[1] = 9;

		const second = await compileModule('int8[] values 4 1 2 3 4');
		const secondView = new Int8Array(second.memoryRef.buffer, values.byteAddress, values.numberOfElements);

		expect(second.memoryAction).toEqual({ action: 'reused' });
		expect(Array.from(secondView)).toEqual([1, 9, 3, 4]);
	});

	it.each([
		{
			instruction: 'int[]',
			initializer: '1 2 3 4',
			updatedInitializer: '-1 -2 -3 -4',
			read: (buffer: ArrayBufferLike, byteAddress: number, length: number) =>
				Array.from(new Int32Array(buffer, byteAddress, length)),
			expected: [-1, -2, -3, -4],
		},
		{
			instruction: 'float[]',
			initializer: '1.5 2.5 3.5 4.5',
			updatedInitializer: '-1.5 -2.5 -3.5 -4.5',
			read: (buffer: ArrayBufferLike, byteAddress: number, length: number) =>
				Array.from(new Float32Array(buffer, byteAddress, length)),
			expected: [-1.5, -2.5, -3.5, -4.5],
		},
	])(
		'keeps $instruction array patching unchanged',
		async ({ instruction, initializer, updatedInitializer, read, expected }) => {
			const first = await compileModule(`${instruction} values 4 ${initializer}`);
			const marker = writeMarker(first);

			const second = await compileModule(`${instruction} values 4 ${updatedInitializer}`);
			const values = second.memoryPlan.modules.mymod!.memory.values!;

			expect(second.memoryAction).toEqual({ action: 'reused' });
			expect(read(second.memoryRef.buffer, values.byteAddress, values.numberOfElements)).toEqual(expected);
			expect(readMarker(second, marker.byteAddress)).toBe(1234);
		}
	);
});
