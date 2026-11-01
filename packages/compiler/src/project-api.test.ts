import type { ProjectObjectModel } from '@8f4e/language-spec';
import { WASM_MEMORY_PAGE_SIZE } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '.';

const source = [
	'8f4e/v1',
	'',
	'function one',
	'push 1',
	'functionEnd int',
	'',
	'entry main',
	'module counter',
	'int value 2',
	'push value',
	'call one',
	'add',
	'drop',
	'moduleEnd',
	'entryEnd',
].join('\n');

const directProject: ProjectObjectModel = {
	code: [],
	modules: [
		{
			id: 8,
			entry: 'main',
			code: ['module counter', 'int value 2', 'push value', 'call one', 'add', 'drop', 'moduleEnd'],
		},
	],
	functions: [{ id: 3, code: ['function one', 'push 1', 'functionEnd int'] }],
	constants: [],
	prototypes: [],
	includes: [],
	notes: [],
	unknown: [],
	groups: [],
};

const relocatedProject: ProjectObjectModel = {
	...directProject,
	functions: [],
	modules: [
		{
			id: 1,
			entry: 'main',
			code: ['module relocated', 'int input 7', 'int output', 'push &output', 'push input', 'store', 'moduleEnd'],
		},
	],
};

describe('project compiler API', () => {
	it('parses text into the canonical project collections', () => {
		expect(parseProjectSource(source)).toEqual(directProject);
	});

	it('compiles directly from an object without a text round trip', async () => {
		const result = await compileProject(directProject, { disableSharedMemory: true });
		expect(result.compiledModules.counter).toBeDefined();
		expect(Object.values(result.compiledFunctions ?? {}).some(func => func.name === 'one')).toBe(true);
	});

	it('produces equivalent output for parsed and directly constructed projects', async () => {
		const [parsedResult, directResult] = await Promise.all([
			compileProject(parseProjectSource(source), { disableSharedMemory: true }),
			compileProject(directProject, { disableSharedMemory: true }),
		]);
		expect(new Uint8Array(parsedResult.codeBuffer)).toEqual(new Uint8Array(directResult.codeBuffer));
		expect(parsedResult.memoryPlan).toEqual(directResult.memoryPlan);
	});

	it('applies the configured starting memory word address to planned and emitted module memory', async () => {
		const [defaultResult, zeroResult, relocatedResult] = await Promise.all([
			compileProject(relocatedProject, { disableSharedMemory: true }),
			compileProject(relocatedProject, { disableSharedMemory: true, startingMemoryAllocationUnitAddress: 0 }),
			compileProject(relocatedProject, { disableSharedMemory: true, startingMemoryAllocationUnitAddress: 8 }),
		]);

		expect(defaultResult.memoryPlan.modules.relocated.byteAddress).toBe(4);
		expect(zeroResult.memoryPlan.modules.relocated.byteAddress).toBe(0);
		expect(relocatedResult.memoryPlan.modules.relocated.byteAddress).toBe(32);
		expect(relocatedResult.memoryPlan.modules.relocated.memory.input.byteAddress).toBe(32);
		expect(relocatedResult.memoryPlan.modules.relocated.memory.output.byteAddress).toBe(36);
		expect(relocatedResult.requiredMemoryBytes).toBe(40);

		const memory = new WebAssembly.Memory({
			initial: Math.ceil(relocatedResult.requiredMemoryBytes / WASM_MEMORY_PAGE_SIZE),
			maximum: Math.ceil(relocatedResult.requiredMemoryBytes / WASM_MEMORY_PAGE_SIZE),
		});
		const { instance } = await WebAssembly.instantiate(relocatedResult.codeBuffer, { host: { memory } });
		(instance.exports.initDefaults as CallableFunction)();
		(instance.exports.main as CallableFunction)();

		expect(new Int32Array(memory.buffer)[9]).toBe(7);
	});

	it('preserves module array order while grouping execution by entry', async () => {
		const project: ProjectObjectModel = {
			...directProject,
			functions: [],
			modules: [
				{ id: 1, entry: 'alternate', code: ['module firstAlternate', 'moduleEnd'] },
				{ id: 2, entry: 'main', code: ['module mainModule', 'moduleEnd'] },
				{ id: 3, entry: 'alternate', code: ['module secondAlternate', 'moduleEnd'] },
			],
		};

		const result = await compileProject(project, { disableSharedMemory: true });
		expect(Object.values(result.compiledModules).sort((a, b) => a.index - b.index)).toMatchObject([
			{ id: 'firstAlternate', executionEntryName: 'alternate' },
			{ id: 'mainModule', executionEntryName: 'main' },
			{ id: 'secondAlternate', executionEntryName: 'alternate' },
		]);
	});
});
