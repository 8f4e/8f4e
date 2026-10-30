import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState from '@8f4e/editor-state';
import { createEditorDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { createDrawContextMock } from './__tests__/rendering';
import { wavePlugin } from './index';

const cleanups: Array<() => void> = [];
const source = ['module audio', 'float[] samples 4 -1 0 1 0', '; @wave &samples count(samples)', 'moduleEnd'];

async function setup(code = source, installed = true, name = 'audio') {
	const project = parseProjectSource(['8f4e/v1', 'entry main', ...code, 'entryEnd'].join('\n'));
	const compiled = await compileProject(project, { disableSharedMemory: true });
	const pages = Math.max(1, Math.ceil(compiled.requiredMemoryBytes / 65536));
	const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
	const { instance } = await WebAssembly.instantiate(new Uint8Array(compiled.codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as CallableFunction)();
	const memoryViews: MemoryViews = {
		int8: new Int8Array(memory.buffer),
		uint8: new Uint8Array(memory.buffer),
		int16: new Int16Array(memory.buffer),
		uint16: new Uint16Array(memory.buffer),
		int32: new Int32Array(memory.buffer),
		float32: new Float32Array(memory.buffer),
		float64: new Float64Array(memory.buffer),
	};
	const events = createEvents();
	const store = initState(events, {
		callbacks: {},
	});
	events.dispatch('enterEditMode');
	const drawers = createEditorDrawerRegistry();
	const dispose = installed
		? wavePlugin.setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				layout: store.layout,
				drawers,
			})
		: () => {};
	cleanups.push(() => {
		dispose();
		store.dispose();
	});
	const state = store.getState();
	state.compiler.memoryPlan = compiled.memoryPlan;
	state.compiler.memoryDefaultsByModuleId = compiled.memoryDefaultsByModuleId;
	state.compiler.compiledModules = compiled.compiledModules;
	state.compiler.compiledFunctions = compiled.compiledFunctions;
	state.compiler.projectMemoryExposuresByGroupPath = compiled.projectMemoryExposuresByGroupPath;
	store.set('initialProjectState', project);
	const codeBlock = state.codeBlockRendering.codeBlocks.find(block => block.name === name)!;
	const draw = createDrawContextMock();
	const render = () => {
		vi.mocked(draw.drawFill).mockClear();
		vi.mocked(draw.startGroup).mockClear();
		vi.mocked(draw.endGroup).mockClear();
		drawers.drawCodeBlock({ draw, state, codeBlock, memoryViews });
	};
	return { store, state, codeBlock, events, draw, memoryViews, render, dispose };
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

describe('wave plugin', () => {
	it.each([
		{ directive: 'wave', rows: 2 },
		{ directive: 'wave2', rows: 4 },
		{ directive: 'wave4', rows: 8 },
	])('contributes $directive layout and draws its waveform', async ({ directive, rows }) => {
		const code = ['module audio', 'float[] samples 4 -1 0 1 0', `; @${directive} &samples count(samples)`, 'moduleEnd'];
		const test = await setup(code);
		test.render();
		const x = (test.codeBlock.lineNumberColumnWidth + 2) * test.state.viewport.vGrid;
		expect(test.codeBlock.gaps.get(2)?.size).toBe(rows);
		expect(test.draw.startGroup).toHaveBeenCalledWith(x, 48);
		expect(test.draw.drawFill).toHaveBeenNthCalledWith(
			1,
			0,
			0,
			PALETTE_INDICES.darkSurface,
			test.codeBlock.width - x,
			rows * 16
		);
	});

	it('supports all height variants in the same block', async () => {
		const test = await setup([
			'module audio',
			'float[] samples 4 -1 0 1 0',
			'; @wave &samples 4',
			'; @wave2 &samples 4',
			'; @wave4 &samples 4',
			'moduleEnd',
		]);
		test.render();
		expect(
			vi
				.mocked(test.draw.drawFill)
				.mock.calls.filter(call => call[2] === PALETTE_INDICES.darkSurface)
				.map(call => call[4])
		).toEqual([32, 64, 128]);
		expect(vi.mocked(test.draw.startGroup).mock.calls.map(call => call[1])).toEqual([48, 96, 176]);
	});

	it.each([
		{ type: 'int8', min: '-128', max: '127' },
		{ type: 'int8u', min: '0', max: '255' },
		{ type: 'int16', min: '-32768', max: '32767' },
		{ type: 'int16u', min: '0', max: '65535' },
		{ type: 'int', min: '-2147483648', max: '2147483647' },
		{ type: 'float', min: '-1.0', max: '1.0' },
		{ type: 'float64', min: '-1.0', max: '1.0' },
	])('reads $type samples with the correct bounds', async ({ type, min, max }) => {
		const test = await setup(['module audio', `${type}[] samples 2 ${min} ${max}`, '; @wave &samples 2', 'moduleEnd']);
		test.render();
		const columns = vi.mocked(test.draw.drawFill).mock.calls.filter(call => call[2] === PALETTE_INDICES.highlightBase);
		expect(columns[0][1]).toBe(31);
		expect(columns.at(-1)![1]).toBe(0);
	});

	it('reads typed pointer starts, a live count, and an absolute playhead', async () => {
		const test = await setup([
			'module audio',
			'float[] samples 4 -1 0 1 0',
			'float* start &samples',
			'int length 4',
			'float* playhead &samples',
			'; @wave start length playhead',
			'moduleEnd',
		]);
		const memory = test.state.compiler.memoryPlan.modules.audio.memory;
		test.memoryViews.int32[memory.playhead.allocationUnitAddress] = memory.samples.byteAddress + 2 * 4;
		test.render();
		const width = test.codeBlock.width - (test.codeBlock.lineNumberColumnWidth + 2) * 8;
		expect(test.draw.drawFill).toHaveBeenLastCalledWith(
			Math.floor((2 / 3) * (width - 4)),
			0,
			PALETTE_INDICES.secondaryReadable,
			4,
			32
		);
		test.memoryViews.int32[memory.length.allocationUnitAddress] = 0;
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		test.memoryViews.int32[memory.length.allocationUnitAddress] = 4;
		test.render();
		expect(test.draw.drawFill).toHaveBeenCalled();
	});

	it('resolves exposed group memory through the public memory API', async () => {
		const test = await setup([
			'group audio',
			'expose samples &voice:samples',
			'; @wave &samples count(samples)',
			'module voice',
			'float[] samples 4 -1 0 1 0',
			'moduleEnd',
			'groupEnd',
		]);
		test.render();
		expect(test.draw.drawFill).toHaveBeenCalledWith(0, 0, PALETTE_INDICES.darkSurface, expect.any(Number), 32);
	});

	it('replaces waves and layout gaps after source edits', async () => {
		const test = await setup();
		test.codeBlock.code[2] = '; @wave4 &samples count(samples)';
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', test.codeBlock);
		test.render();
		expect(test.codeBlock.gaps.get(2)?.size).toBe(8);
		expect(test.draw.drawFill).toHaveBeenNthCalledWith(1, 0, 0, PALETTE_INDICES.darkSurface, expect.any(Number), 128);
		test.codeBlock.code[2] = '; no wave';
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', test.codeBlock);
		test.render();
		expect(test.codeBlock.gaps.size).toBe(0);
		expect(test.draw.drawFill).not.toHaveBeenCalled();
	});

	it('recomputes geometry when the grid changes', async () => {
		const test = await setup();
		test.state.viewport.vGrid = 10;
		test.state.viewport.hGrid = 20;
		test.events.dispatch('spriteSheetRerendered');
		test.render();
		const x = (test.codeBlock.lineNumberColumnWidth + 2) * 10;
		expect(test.draw.startGroup).toHaveBeenCalledWith(x, 60);
		expect(test.draw.drawFill).toHaveBeenNthCalledWith(
			1,
			0,
			0,
			PALETTE_INDICES.darkSurface,
			test.codeBlock.width - x,
			40
		);
	});

	it('rebinds compiler memory metadata and removes unresolved waves', async () => {
		const test = await setup();
		const memory = test.state.compiler.memoryPlan.modules.audio.memory;
		memory.samples = {
			...memory.samples,
			byteAddress: memory.samples.byteAddress + 64,
			allocationUnitAddress: memory.samples.allocationUnitAddress + 16,
		};
		test.memoryViews.float32[memory.samples.allocationUnitAddress] = -1;
		test.events.dispatch('memoryValuesChanged');
		test.render();
		expect(
			vi.mocked(test.draw.drawFill).mock.calls.filter(call => call[2] === PALETTE_INDICES.highlightBase)[0][1]
		).toBe(31);
		delete memory.samples;
		test.events.dispatch('memoryValuesChanged');
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
	});

	it.each(['; @wave missing 4', '; @wave &samples missingCount', '; @wave &samples 0', '; @wave *samples 4'])(
		'skips unresolved or invalid wave data: %s',
		async line => {
			const test = await setup(['module audio', 'float[] samples 4 -1 0 1 0', line, 'moduleEnd']);
			test.render();
			expect(test.draw.drawFill).not.toHaveBeenCalled();
		}
	);

	it('keeps only generic parsed directives when omitted', async () => {
		const test = await setup(source, false);
		test.render();
		expect(test.codeBlock.parsedDirectives).toContainEqual(
			expect.objectContaining({ name: 'wave', args: ['&samples', 'count(samples)'] })
		);
		expect(test.codeBlock.gaps.size).toBe(0);
		expect(test.draw.drawFill).not.toHaveBeenCalled();
	});

	it('unregisters all definitions and the drawer on disposal', async () => {
		const test = await setup();
		test.dispose();
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', test.codeBlock);
		test.render();
		expect(test.codeBlock.gaps.size).toBe(0);
		expect(test.draw.drawFill).not.toHaveBeenCalled();
	});

	it('keeps wave data and registrations independent across editors', async () => {
		const first = await setup();
		const second = await setup();
		first.dispose();
		first.render();
		second.render();
		expect(first.draw.drawFill).not.toHaveBeenCalled();
		expect(second.draw.drawFill).toHaveBeenCalled();
	});
});
