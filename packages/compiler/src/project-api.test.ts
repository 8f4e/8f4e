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
	entries: ['main'],
	code: [],
	execution: [
		{
			type: 'module',
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
};

const relocatedProject: ProjectObjectModel = {
	...directProject,
	functions: [],
	execution: [
		{
			type: 'module',
			id: 1,
			entry: 'main',
			code: ['module relocated', 'int input 7', 'int output', 'push &output', 'push input', 'store', 'moduleEnd'],
		},
	],

	entries: ['main'],
};

describe('project compiler API', () => {
	it('parses text into the canonical project collections', () => {
		expect(parseProjectSource(source)).toEqual(directProject);
	});

	it('compiles directly from an object without a text round trip', async () => {
		const result = await compileProject(directProject);
		expect(result.compiledModules.counter).toBeDefined();
		expect(Object.values(result.compiledFunctions ?? {}).some(func => func.name === 'one')).toBe(true);
	});

	it('produces equivalent output for parsed and directly constructed projects', async () => {
		const [parsedResult, directResult] = await Promise.all([
			compileProject(parseProjectSource(source)),
			compileProject(directProject),
		]);
		expect(new Uint8Array(parsedResult.codeBuffer)).toEqual(new Uint8Array(directResult.codeBuffer));
		expect(parsedResult.memoryPlan).toEqual(directResult.memoryPlan);
	});

	it('exports root entries while keeping group entries in their own scope', async () => {
		const project = parseProjectSource(`8f4e/v1
entry foo
entryEnd
entry main
group child
entry foo
entryEnd
entry bar
entryEnd
groupEnd
entryEnd`);
		const result = await compileProject(project);
		const exports = WebAssembly.Module.exports(new WebAssembly.Module(new Uint8Array(result.codeBuffer)));
		expect(exports.map(item => item.name).sort()).toEqual(['foo', 'initDefaults', 'main']);
	});

	it('applies the configured starting memory word address to planned and emitted module memory', async () => {
		const [defaultResult, zeroResult, relocatedResult] = await Promise.all([
			compileProject(relocatedProject),
			compileProject(relocatedProject, { startingMemoryAllocationUnitAddress: 0 }),
			compileProject(relocatedProject, { startingMemoryAllocationUnitAddress: 8 }),
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
			shared: true,
		});
		const { instance } = await WebAssembly.instantiate(relocatedResult.codeBuffer, { host: { memory } });
		(instance.exports.initDefaults as CallableFunction)();
		(instance.exports.main as CallableFunction)();

		expect(new Int32Array(memory.buffer)[9]).toBe(7);
	});

	it('resolves root env overrides before deriving constants and laying out buffers', async () => {
		const project = parseProjectSource(`8f4e/v1
constants env
const SAMPLE_RATE 48000
const HALF_RATE SAMPLE_RATE/2
const AUDIO_BUFFER_SIZE 128
constantsEnd

entry main
group voice
pass env
entry main
module out
use env
float[] buffer AUDIO_BUFFER_SIZE
int rate HALF_RATE
moduleEnd
entryEnd
groupEnd
group local
constants env
const SAMPLE_RATE 16000
constantsEnd
entry main
module out
use env
int rate SAMPLE_RATE
moduleEnd
entryEnd
groupEnd
entryEnd`);
		const defaults = await compileProject(project);
		const options = { cache: defaults.cache, envOverrides: { SAMPLE_RATE: 32000, AUDIO_BUFFER_SIZE: 64 } };
		const overridden = await compileProject(project, options);
		expect(overridden.envConstants).toEqual({ SAMPLE_RATE: 32000, HALF_RATE: 16000, AUDIO_BUFFER_SIZE: 64 });
		expect(overridden.memoryPlan.modules['voice/out'].memory.buffer.numberOfElements).toBe(64);

		const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
		const { instance } = await WebAssembly.instantiate(overridden.codeBuffer, { host: { memory } });
		(instance.exports.initDefaults as () => void)();
		const view = new DataView(memory.buffer);
		expect(view.getInt32(overridden.memoryPlan.modules['voice/out'].memory.rate.byteAddress, true)).toBe(16000);
		expect(view.getInt32(overridden.memoryPlan.modules['local/out'].memory.rate.byteAddress, true)).toBe(16000);

		const repeatedDefaults = await compileProject(project, { cache: defaults.cache });
		expect(repeatedDefaults.envConstants).toEqual({ SAMPLE_RATE: 48000, HALF_RATE: 24000, AUDIO_BUFFER_SIZE: 128 });
		expect(repeatedDefaults.codeBuffer).toEqual(defaults.codeBuffer);
	});

	it('rejects unknown env names and fractional overrides of integer constants', async () => {
		const project = parseProjectSource('8f4e/v1\nconstants env\nconst SAMPLE_RATE 48000\nconstantsEnd');
		await expect(compileProject(project, { envOverrides: { UNKNOWN: 1 } })).rejects.toThrow(
			'Unknown root env constant UNKNOWN'
		);
		await expect(compileProject(project, { envOverrides: { SAMPLE_RATE: 32000.5 } })).rejects.toThrow(
			'Override for env:SAMPLE_RATE must be a safe integer'
		);
	});

	it('preserves module array order while grouping execution by entry', async () => {
		const project: ProjectObjectModel = {
			...directProject,
			functions: [],
			execution: [
				{ type: 'module', id: 1, entry: 'alternate', code: ['module firstAlternate', 'moduleEnd'] },
				{ type: 'module', id: 2, entry: 'main', code: ['module mainModule', 'moduleEnd'] },
				{ type: 'module', id: 3, entry: 'alternate', code: ['module secondAlternate', 'moduleEnd'] },
			],

			entries: ['alternate', 'main'],
		};

		const result = await compileProject(project);
		expect(Object.values(result.compiledModules).sort((a, b) => a.index - b.index)).toMatchObject([
			{ id: 'firstAlternate', executionEntryName: 'alternate' },
			{ id: 'mainModule', executionEntryName: 'main' },
			{ id: 'secondAlternate', executionEntryName: 'alternate' },
		]);
	});
});
