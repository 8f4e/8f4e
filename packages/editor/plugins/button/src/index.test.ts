import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState from '@8f4e/editor-state';
import { createCodeBlockDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { createDrawContextMock } from './__tests__/rendering';
import { buttonPlugin } from './index';

const cleanups: Array<() => void> = [];
const source = ['module controls', 'int gate 0', '; @button &gate', 'moduleEnd'];

async function setup(code = source, installed = true, name = 'controls') {
	const project = parseProjectSource(['8f4e/v1', 'entry main', ...code, 'entryEnd'].join('\n'));
	const compiled = await compileProject(project, { disableSharedMemory: true });
	const buffer = new ArrayBuffer(65536);
	const memoryViews: MemoryViews = {
		int8: new Int8Array(buffer),
		int16: new Int16Array(buffer),
		int32: new Int32Array(buffer),
		uint8: new Uint8Array(buffer),
		uint16: new Uint16Array(buffer),
		float32: new Float32Array(buffer),
		float64: new Float64Array(buffer),
	};
	const events = createEvents();
	const write = vi.fn((address: number, value: number, isInteger: boolean) => {
		if (isInteger) memoryViews.int32[address] = value;
		else memoryViews.float32[address] = value;
	});
	const store = initState(events, {
		runtimeRegistry: {},
		initialEditorMode: 'edit',
		callbacks: { setWordInMemory: write },
	});
	const drawers = createCodeBlockDrawerRegistry();
	const dispose = installed
		? buttonPlugin.setup({ store, events, menus: store.menus, directives: store.directives, drawers })
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
		vi.mocked(draw.drawText).mockClear();
		drawers.drawCodeBlock({ draw, state, codeBlock, memoryViews });
	};
	const point = (row = 2) => ({
		x: codeBlock.x + codeBlock.width - 4 * state.viewport.vGrid - state.viewport.x + 1,
		y: codeBlock.y + row * state.viewport.hGrid - state.viewport.y + 1,
	});
	const press = (row = 2) => events.dispatch('codeBlockPointerDown', { codeBlock, ...point(row) });
	const release = () => events.dispatch('mouseup');
	return { store, state, codeBlock, events, memoryViews, draw, write, render, point, press, release, dispose };
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

describe('button plugin', () => {
	it('derives geometry and draws released, pressed, and unmatched memory values', async () => {
		const test = await setup();
		test.render();
		const x = test.codeBlock.width - 32;
		expect(test.draw.drawFill).toHaveBeenNthCalledWith(1, x, 32, PALETTE_INDICES.accentSurface, 32, 16);
		expect(test.draw.drawText).toHaveBeenCalledWith(x, 32, '[| ]', PALETTE_INDICES.darkBase);
		test.press();
		test.render();
		expect(test.draw.drawFill).toHaveBeenNthCalledWith(2, x + 16, 32, PALETTE_INDICES.lightBase, 8, 16);
		expect(test.draw.drawText).toHaveBeenCalledWith(x, 32, '[ |]', PALETTE_INDICES.darkBase);
		const address = test.state.compiler.memoryPlan.modules.controls.memory.gate.allocationUnitAddress;
		test.memoryViews.int32[address] = 7;
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		expect(test.draw.drawText).toHaveBeenCalledWith(x, 32, '[__]', PALETTE_INDICES.secondaryBase);
	});

	it.each([true, false])('presses and releases through pointer events with editing=%s', async editing => {
		const test = await setup(['module controls', 'int gate 0', '; @button &gate', '; @pos 40 20', 'moduleEnd']);
		test.store.set('featureFlags.editing', editing);
		test.events.dispatch('mousedown', { ...test.point(), buttons: 1, altKey: false });
		const address = test.state.compiler.memoryPlan.modules.controls.memory.gate.allocationUnitAddress;
		expect(test.write).toHaveBeenLastCalledWith(address, 1, true);
		test.release();
		expect(test.write).toHaveBeenLastCalledWith(address, 0, true);
		test.write.mockClear();
		test.release();
		expect(test.write).not.toHaveBeenCalled();
	});

	it('writes configured float values and draws them from float memory', async () => {
		const test = await setup(['module controls', 'float gate 0.1', '; @button &gate 0.1 0.9', 'moduleEnd']);
		const address = test.state.compiler.memoryPlan.modules.controls.memory.gate.allocationUnitAddress;
		test.memoryViews.float32[address] = 0.1;
		test.render();
		expect(test.draw.drawText).toHaveBeenCalledWith(expect.any(Number), 32, '[| ]', PALETTE_INDICES.darkBase);
		test.press();
		test.render();
		expect(test.write).toHaveBeenLastCalledWith(address, 0.9, false);
		expect(test.draw.drawText).toHaveBeenCalledWith(expect.any(Number), 32, '[ |]', PALETTE_INDICES.darkBase);
		test.release();
		expect(test.write).toHaveBeenLastCalledWith(address, 0.1, false);
	});

	it('hit-tests using block position, viewport origin, and directive row', async () => {
		const test = await setup();
		test.codeBlock.x = 200;
		test.codeBlock.y = 160;
		test.state.viewport.x = 150;
		test.state.viewport.y = 100;
		test.events.dispatch('codeBlockPointerDown', { codeBlock: test.codeBlock, x: 0, y: 0 });
		expect(test.write).not.toHaveBeenCalled();
		test.press();
		expect(test.write).toHaveBeenCalledOnce();
	});

	it('replaces button data after source edits and removes deleted directives', async () => {
		const test = await setup();
		test.codeBlock.code[2] = '; @button &gate -5 100';
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', test.codeBlock);
		test.press();
		expect(test.write).toHaveBeenLastCalledWith(expect.any(Number), 100, true);
		test.release();
		expect(test.write).toHaveBeenLastCalledWith(expect.any(Number), -5, true);
		test.codeBlock.code[2] = '; no widget';
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', test.codeBlock);
		test.write.mockClear();
		test.press();
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		expect(test.write).not.toHaveBeenCalled();
	});

	it('recomputes positions after font dimensions change', async () => {
		const test = await setup();
		test.state.viewport.vGrid = 10;
		test.state.viewport.hGrid = 20;
		test.events.dispatch('spriteSheetRerendered');
		test.render();
		expect(test.draw.drawFill).toHaveBeenNthCalledWith(
			1,
			test.codeBlock.width - 40,
			40,
			PALETTE_INDICES.accentSurface,
			40,
			20
		);
		test.press();
		expect(test.write).toHaveBeenCalledOnce();
	});

	it('supports multiple buttons in one block', async () => {
		const test = await setup([
			'module controls',
			'int gate 0',
			'int second 0',
			'; @button &gate',
			'; @button &second 10 20',
			'moduleEnd',
		]);
		const first = test.state.compiler.memoryPlan.modules.controls.memory.gate.allocationUnitAddress;
		const second = test.state.compiler.memoryPlan.modules.controls.memory.second.allocationUnitAddress;
		test.press(3);
		expect(test.write).toHaveBeenLastCalledWith(first, 1, true);
		test.release();
		test.press(4);
		expect(test.write).toHaveBeenLastCalledWith(second, 20, true);
		test.release();
		expect(test.write).toHaveBeenLastCalledWith(second, 10, true);
	});

	it('resolves cross-module references through the public memory API', async () => {
		const test = await setup([
			'module controls',
			'int gate 0',
			'; @button &other:gate',
			'moduleEnd',
			'module other',
			'int gate 0',
			'moduleEnd',
		]);
		const address = test.state.compiler.memoryPlan.modules.other.memory.gate.allocationUnitAddress;
		test.press();
		expect(test.write).toHaveBeenLastCalledWith(address, 1, true);
		test.release();
		expect(test.write).toHaveBeenLastCalledWith(address, 0, true);
	});

	it('resolves group exposures and writes to their backing module', async () => {
		const test = await setup([
			'group controls',
			'expose gate &voice:gate',
			'; @button &gate',
			'module voice',
			'int gate 0',
			'moduleEnd',
			'groupEnd',
		]);
		const address = test.state.compiler.memoryPlan.modules['controls/voice'].memory.gate.allocationUnitAddress;
		test.press();
		expect(test.write).toHaveBeenLastCalledWith(address, 1, true);
		test.release();
		expect(test.write).toHaveBeenLastCalledWith(address, 0, true);
	});

	it('rebinds after runtime memory metadata changes and drops unresolved buttons', async () => {
		const test = await setup();
		const memory = test.state.compiler.memoryPlan.modules.controls.memory;
		const address = memory.gate.allocationUnitAddress + 4;
		memory.gate = { ...memory.gate, allocationUnitAddress: address };
		test.events.dispatch('runtimeInitialized');
		test.press();
		test.release();
		expect(test.write).toHaveBeenLastCalledWith(address, 0, true);
		delete memory.gate;
		test.events.dispatch('runtimeInitialized');
		test.write.mockClear();
		test.press();
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		expect(test.write).not.toHaveBeenCalled();
	});

	it.each(['; @button &missing', '; @button &gate bad', 'int extra 0 ; @button &gate'])(
		'creates no button for an unresolved or invalid directive: %s',
		async line => {
			const test = await setup(['module controls', 'int gate 0', line, 'moduleEnd']);
			test.render();
			test.press();
			expect(test.draw.drawFill).not.toHaveBeenCalled();
			expect(test.write).not.toHaveBeenCalled();
		}
	);

	it('leaves only the generic parsed directive when the plugin is omitted', async () => {
		const test = await setup(source, false);
		expect(test.codeBlock.parsedDirectives).toContainEqual(
			expect.objectContaining({ name: 'button', args: ['&gate'] })
		);
		expect(test.codeBlock.widgets).not.toHaveProperty('buttons');
		test.press();
		test.release();
		test.render();
		expect(test.write).not.toHaveBeenCalled();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
	});

	it('releases a held button and unregisters its listeners, directive, and drawer on disposal', async () => {
		const test = await setup();
		test.press();
		test.dispose();
		expect(test.write).toHaveBeenLastCalledWith(expect.any(Number), 0, true);
		test.write.mockClear();
		test.press();
		test.release();
		test.render();
		expect(test.write).not.toHaveBeenCalled();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
	});

	it('keeps button data and held state independent across editors', async () => {
		const first = await setup();
		const second = await setup();
		first.press();
		second.release();
		expect(second.write).not.toHaveBeenCalled();
		first.dispose();
		second.press();
		second.render();
		expect(second.draw.drawText).toHaveBeenCalledWith(expect.any(Number), 32, '[ |]', PALETTE_INDICES.darkBase);
	});
});
