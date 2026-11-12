import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initState from '@8f4e/editor-state';
import type { MemoryViews } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCompilerResult } from '../__tests__/compilerResult';
import { createEvents } from '../__tests__/events';
import { createDrawContextMock } from '../__tests__/rendering';
import drawTooltip from '../drawer/draw';
import createTooltip from './effect';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

async function setup(source: string) {
	const project = parseProjectSource(source);
	const compiled = await compileProject(project);
	const events = createEvents();
	const store = initState(events, { callbacks: {} });
	const tooltip = createTooltip(store, events);
	cleanups.push(() => {
		tooltip.dispose();
		store.dispose();
	});
	store.set('editorMode', 'edit');
	store.set('initialProjectState', project);
	store.set('compiler.result', createCompilerResult(compiled, store.getState().compilerInputRevision));
	const state = store.getState();
	const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'sink')!;
	store.set('codeBlockRendering.selectedCodeBlock', block);
	store.set(
		'codeBlockRendering.selectedCodeBlock.cursor.row',
		block.code.findIndex(line => line.includes(' input'))
	);
	const buffer = new ArrayBuffer(65536);
	const memory: MemoryViews = {
		int8: new Int8Array(buffer),
		uint8: new Uint8Array(buffer),
		int16: new Int16Array(buffer),
		uint16: new Uint16Array(buffer),
		int32: new Int32Array(buffer),
		float32: new Float32Array(buffer),
		float64: new Float64Array(buffer),
	};

	function renderValues() {
		const current = tooltip.getState();
		current.animation.startedAt = undefined;
		const engine = createDrawContextMock();
		drawTooltip(engine, state, block, memory, current);
		return vi.mocked(engine.drawNumericText).mock.calls.map(([, , text]) => text);
	}

	return { compiled, store, tooltip, block, memory, renderValues };
}

const namedSource = (declaration = 'float& input &source:output') => `8f4e/v1
entry main
module source
float output 1.5
moduleEnd
module sink
${declaration}
moduleEnd
entryEnd`;

describe('fixed reference live tooltips', () => {
	it('retains prepared addresses and formats while reading live memory without target lookups', async () => {
		const { compiled, memory, renderValues } = await setup(namedSource());
		const references = compiled.compiledModules.sink.referenceSlots;
		const slot = references.input;
		const target = slot.targetMemory;
		const lookup = vi.fn(() => slot);
		Object.defineProperty(references, 'input', { configurable: true, get: lookup });

		memory.float32[target.byteAddress / 4] = 1.5;
		expect(renderValues()).toEqual([String(target.byteAddress), '1.5000']);
		memory.float32[target.byteAddress / 4] = -2.75;
		expect(renderValues()).toEqual([String(target.byteAddress), '-2.7500']);
		expect(lookup).not.toHaveBeenCalled();
	});
	it.each([
		{ name: 'named', target: '&source:output', local: false, grouped: false },
		{ name: 'indexed', target: '&source:0', local: false, grouped: false },
		{ name: 'local indexed', target: '&this:0', local: true, grouped: false },
		{ name: 'local named', target: '&output', local: true, grouped: false },
		{ name: 'group-exposed', target: '&audio:signal', local: false, grouped: true },
	])('displays the address and live value of a $name target', async ({ target, local, grouped }) => {
		const fixture = await setup(`8f4e/v1
entry main
${grouped ? 'group audio\nexpose signal &source:output\nentry main' : ''}
module source
float[] output 2 1.5 2.5
moduleEnd
${grouped ? 'entryEnd\ngroupEnd' : ''}
module sink
${local ? 'float[] output 2 1.5 2.5' : ''}
float& input ${target}
moduleEnd
entryEnd`);
		const { compiled, tooltip, memory, renderValues } = fixture;
		const slot = compiled.compiledModules.sink.referenceSlots.input;
		memory.float32[slot.targetMemory.byteAddress / 4] = 1.5;
		memory.float32[slot.targetMemory.byteAddress / 4 + 1] = 2.5;
		expect(tooltip.getState().text.slice(-2)).toEqual(['value: ', 'deref: ']);
		expect(tooltip.getState().text).not.toContain('address: ');
		expect(renderValues()).toEqual([String(slot.targetMemory.byteAddress), '1.5000']);

		memory.float32[slot.targetMemory.byteAddress / 4] = -3.25;
		expect(renderValues()).toEqual([String(slot.targetMemory.byteAddress), '-3.2500']);
	});

	it.each([
		{ type: 'int', declaration: 'int[]', view: 'int32', size: 4, value: -123456, expected: '-123456' },
		{ type: 'int8', declaration: 'int8[]', view: 'int8', size: 1, value: -12, expected: '-12' },
		{ type: 'int8u', declaration: 'int8u[]', view: 'uint8', size: 1, value: 255, expected: '255' },
		{ type: 'int16', declaration: 'int16[]', view: 'int16', size: 2, value: -1234, expected: '-1234' },
		{ type: 'int16u', declaration: 'int16u[]', view: 'uint16', size: 2, value: 65535, expected: '65535' },
		{ type: 'float', declaration: 'float[]', view: 'float32', size: 4, value: 3.25, expected: '3.2500' },
		{ type: 'float64', declaration: 'float64[]', view: 'float64', size: 8, value: Math.PI, expected: '3.1416' },
	] as const)(
		'formats $type& with the target storage format',
		async ({ type, declaration, view, size, value, expected }) => {
			const { compiled, memory, renderValues } = await setup(`8f4e/v1
entry main
module source
int padding
${declaration} output 2
moduleEnd
module sink
${type}& input &source:output
moduleEnd
entryEnd`);
			const target = compiled.compiledModules.sink.referenceSlots.input.targetMemory;
			memory[view][target.byteAddress / size] = value;
			expect(renderValues()).toEqual([String(target.byteAddress), expected]);
		}
	);

	it.each([
		{ declaration: 'float& input &source:output', moduleId: 'source', memoryId: 'output' },
		{ declaration: 'float input 1.5', moduleId: 'sink', memoryId: 'input' },
	])(
		'refreshes $declaration after a cached recompilation changes the layout',
		async ({ declaration, moduleId, memoryId }) => {
			const { compiled, store, memory, renderValues } = await setup(namedSource(declaration));
			const originalAddress = compiled.memoryPlan.modules[moduleId].memory[memoryId].byteAddress;
			memory.float32[originalAddress / 4] = 1.5;
			expect(renderValues()).toEqual([String(originalAddress), '1.5000']);
			const next = await compileProject(parseProjectSource(namedSource(declaration)), {
				cache: compiled.cache,
				startingMemoryAllocationUnitAddress: 16,
			});
			const nextAddress = next.memoryPlan.modules[moduleId].memory[memoryId].byteAddress;
			expect(nextAddress).not.toBe(originalAddress);
			memory.float32[nextAddress / 4] = 2.75;
			store.set('compiler.result', { ...store.getState().compiler.result, ...next });
			expect(renderValues()).toEqual([String(nextAddress), '2.7500']);
		}
	);

	it.each(['missing module', 'missing slot', 'inactive source'] as const)(
		'keeps documentation without live rows for %s metadata',
		async reason => {
			const { compiled, store, tooltip } = await setup(namedSource());
			const sink = compiled.compiledModules.sink;
			const modules = { ...compiled.compiledModules };
			if (reason === 'missing module') {
				delete modules.sink;
			} else {
				modules.sink = {
					...sink,
					referenceSlots: reason === 'missing slot' ? {} : sink.referenceSlots,
					ast: { ...sink.ast, projectBlockId: reason === 'inactive source' ? -1 : sink.ast.projectBlockId },
				};
			}
			store.set('compiler.result.compiledModules', modules);
			expect(tooltip.getState().text.length).toBeGreaterThan(0);
			expect(tooltip.getState().liveValues).toEqual([]);
		}
	);

	it('shows an invalid marker for unavailable runtime memory while retaining the resolved address', async () => {
		const { compiled, memory, renderValues } = await setup(namedSource());
		const address = compiled.compiledModules.sink.referenceSlots.input.targetMemory.byteAddress;
		memory.float32 = new Float32Array(0);
		expect(renderValues()).toEqual([String(address), '?']);
	});
});

const numericCases = [
	{ type: 'int8u', view: 'uint8', size: 1, first: 200, second: 255, firstText: '200', secondText: '255' },
	{ type: 'float', view: 'float32', size: 4, first: 1.5, second: 2.75, firstText: '1.5000', secondText: '2.7500' },
	{
		type: 'float64',
		view: 'float64',
		size: 8,
		first: Math.PI,
		second: Math.E,
		firstText: '3.1416',
		secondText: '2.7183',
	},
] as const;

describe('allocated memory live tooltips', () => {
	it.each(numericCases)(
		'reads $type buffers without resolving names during drawing',
		async ({ type, view, size, first, second, firstText, secondText }) => {
			const { compiled, tooltip, memory, renderValues } = await setup(`8f4e/v1
entry main
module sink
${type}[] input 2
moduleEnd
entryEnd`);
			const declarations = compiled.memoryPlan.modules.sink.memory;
			const input = declarations.input;
			const lookup = vi.fn(() => input);
			Object.defineProperty(declarations, 'input', { configurable: true, get: lookup });
			expect(tooltip.getState().text.slice(-2)).toEqual(['address: ', 'value[0]: ']);
			memory[view][input.byteAddress / size] = first;
			expect(renderValues()).toEqual([String(input.byteAddress), firstText]);
			memory[view][input.byteAddress / size] = second;
			expect(renderValues()).toEqual([String(input.byteAddress), secondText]);
			expect(lookup).not.toHaveBeenCalled();
		}
	);

	it.each(numericCases)(
		'follows a $type pointer using its prepared slot and read format',
		async ({ type, view, size, first, second, firstText, secondText }) => {
			const { compiled, tooltip, memory, renderValues } = await setup(`8f4e/v1
entry main
module source
${type}[] output 2
moduleEnd
module sink
${type}* input &source:output
moduleEnd
entryEnd`);
			const declarations = compiled.memoryPlan.modules.sink.memory;
			const pointer = declarations.input;
			const output = compiled.memoryPlan.modules.source.memory.output;
			const lookup = vi.fn(() => pointer);
			Object.defineProperty(declarations, 'input', { configurable: true, get: lookup });
			expect(tooltip.getState().text.slice(-3)).toEqual(['address: ', 'value: ', 'deref: ']);
			memory[view][output.byteAddress / size] = first;
			memory[view][output.byteAddress / size + 1] = second;
			memory.int32[pointer.allocationUnitAddress] = output.byteAddress;
			expect(renderValues()).toEqual([String(pointer.byteAddress), String(output.byteAddress), firstText]);
			memory.int32[pointer.allocationUnitAddress] = output.byteAddress + size;
			expect(renderValues()).toEqual([String(pointer.byteAddress), String(output.byteAddress + size), secondText]);
			expect(lookup).not.toHaveBeenCalled();
		}
	);
});
