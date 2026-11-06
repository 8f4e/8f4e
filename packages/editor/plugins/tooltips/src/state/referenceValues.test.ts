import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initState from '@8f4e/editor-state';
import type { MemoryViews } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
	const compiled = await compileProject(project, { disableSharedMemory: true });
	const events = createEvents();
	const store = initState(events, { callbacks: {} });
	const tooltip = createTooltip(store, events);
	cleanups.push(() => {
		tooltip.dispose();
		store.dispose();
	});
	store.set('editorMode', 'edit');
	store.set('compiler.result', compiled);
	store.set('initialProjectState', project);
	const state = store.getState();
	const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'sink')!;
	store.set('codeBlockRendering.selectedCodeBlock', block);
	store.set(
		'codeBlockRendering.selectedCodeBlock.cursor.row',
		block.code.findIndex(line => line.includes('& input'))
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

const namedSource = (padding = '') => `8f4e/v1
entry main
module source
${padding}
float output 1.5
moduleEnd
module sink
float& input &source:output
moduleEnd
entryEnd`;

describe('fixed reference live tooltips', () => {
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

	it('refreshes the address after a cached recompilation changes the target layout', async () => {
		const { compiled, store, memory, renderValues } = await setup(namedSource());
		const originalAddress = compiled.compiledModules.sink.referenceSlots.input.targetMemory.byteAddress;
		memory.float32[originalAddress / 4] = 1.5;
		expect(renderValues()).toEqual([String(originalAddress), '1.5000']);
		const next = await compileProject(parseProjectSource(namedSource('int padding')), {
			disableSharedMemory: true,
			cache: compiled.cache,
		});
		const nextAddress = next.compiledModules.sink.referenceSlots.input.targetMemory.byteAddress;
		expect(nextAddress).not.toBe(originalAddress);
		memory.float32[nextAddress / 4] = 2.75;
		store.set('compiler.result', next);
		expect(renderValues()).toEqual([String(nextAddress), '2.7500']);
	});

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
