import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState from '@8f4e/editor-state';
import type { EventDispatcher } from '@8f4e/editor-state-types';
import { createCodeBlockDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { switchPlugin } from './index';

const cleanups: Array<() => void> = [];
const source = ['module controls', 'int gate 0', '; @switch &gate', 'moduleEnd'];

function createEvents(): EventDispatcher {
	const listeners = new Map<string, Set<(event: unknown) => void>>();
	return {
		on: (name, listener) => {
			if (!listeners.has(name)) listeners.set(name, new Set());
			listeners.get(name)!.add(listener as (event: unknown) => void);
		},
		off: (name, listener) => {
			listeners.get(name)?.delete(listener as (event: unknown) => void);
		},
		dispatch: (name, event) => {
			for (const listener of listeners.get(name) ?? []) listener(event);
		},
	};
}

async function setup(code = source, installed = true) {
	const project = parseProjectSource(['8f4e/v1', '', 'entry main', ...code, 'entryEnd'].join('\n'));
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
		callbacks: {
			getWordFromMemory: address => memoryViews.int32[address],
			setWordInMemory: write,
		},
	});
	const drawers = createCodeBlockDrawerRegistry();
	const disposePlugin = installed
		? switchPlugin.setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
				drawers,
			})
		: () => {};
	cleanups.push(() => {
		disposePlugin();
		store.dispose();
	});
	const state = store.getState();
	state.compiler.memoryPlan = compiled.memoryPlan;
	state.compiler.memoryDefaultsByModuleId = compiled.memoryDefaultsByModuleId;
	state.compiler.compiledModules = compiled.compiledModules;
	state.compiler.compiledFunctions = compiled.compiledFunctions;
	state.compiler.projectMemoryExposuresByGroupPath = compiled.projectMemoryExposuresByGroupPath;
	store.set('initialProjectState', project);
	const codeBlock = state.codeBlockRendering.codeBlocks.find(block => block.name === 'controls')!;
	const address = compiled.memoryPlan.modules.controls.memory.gate.allocationUnitAddress;
	const draw = {
		drawSprite: vi.fn(),
		drawFill: vi.fn(),
		drawCharacter: vi.fn(),
		drawText: vi.fn(),
		drawResolvedText: vi.fn(),
		startGroup: vi.fn(),
		endGroup: vi.fn(),
	} as unknown as DrawContext;
	const render = () => {
		vi.mocked(draw.drawFill).mockClear();
		vi.mocked(draw.drawText).mockClear();
		drawers.drawCodeBlock({ draw, state, codeBlock, memoryViews });
	};
	const press = () =>
		events.dispatch('codeBlockPointerDown', {
			codeBlock,
			x: codeBlock.x + codeBlock.width - 4 * state.viewport.vGrid - state.viewport.x + 1,
			y: codeBlock.y + 2 * state.viewport.hGrid - state.viewport.y + 1,
		});
	return { store, state, events, drawers, codeBlock, memoryViews, draw, write, render, press, address, disposePlugin };
}

describe('switch plugin', () => {
	afterEach(() => {
		while (cleanups.length) cleanups.pop()!();
	});

	it('derives switch geometry and draws the current memory value', async () => {
		const test = await setup();
		test.render();
		const x = test.codeBlock.width - 32;
		expect(test.draw.drawFill).toHaveBeenNthCalledWith(1, x, 32, PALETTE_INDICES.accentSurface, 32, 16);
		expect(test.draw.drawFill).toHaveBeenNthCalledWith(2, x + 8, 32, PALETTE_INDICES.lightBase, 8, 16);
		expect(test.draw.drawText).toHaveBeenCalledWith(x, 32, '[| ]', PALETTE_INDICES.darkBase);
		test.memoryViews.int32[test.address] = 1;
		test.render();
		expect(test.draw.drawFill).toHaveBeenNthCalledWith(2, x + 16, 32, PALETTE_INDICES.lightBase, 8, 16);
		expect(test.draw.drawText).toHaveBeenCalledWith(x, 32, '[ |]', PALETTE_INDICES.darkBase);
	});

	it('toggles through the state event pipeline in view mode as well as edit mode', async () => {
		const test = await setup();
		test.store.set('featureFlags.editing', false);
		test.press();
		expect(test.write).toHaveBeenLastCalledWith(test.address, 1, true);
		test.press();
		expect(test.write).toHaveBeenLastCalledWith(test.address, 0, true);
	});

	it('uses configured values and resets an unmatched value to off', async () => {
		const test = await setup(['module controls', 'int gate 0', '; @switch &gate -5 100', 'moduleEnd']);
		test.memoryViews.int32[test.address] = -5;
		test.press();
		expect(test.write).toHaveBeenLastCalledWith(test.address, 100, true);
		test.press();
		expect(test.write).toHaveBeenLastCalledWith(test.address, -5, true);
		test.memoryViews.int32[test.address] = 42;
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		expect(test.draw.drawText).toHaveBeenCalledWith(
			test.codeBlock.width - 32,
			32,
			'[__]',
			PALETTE_INDICES.secondaryBase
		);
		test.press();
		expect(test.write).toHaveBeenLastCalledWith(test.address, -5, true);
	});

	it('hit-tests using the current block position and viewport offset', async () => {
		const test = await setup();
		test.codeBlock.x = 200;
		test.codeBlock.y = 160;
		test.state.viewport.x = 150;
		test.state.viewport.y = 100;
		test.events.dispatch('codeBlockPointerDown', { codeBlock: test.codeBlock, x: 0, y: 0 });
		expect(test.write).not.toHaveBeenCalled();
		test.press();
		expect(test.memoryViews.int32[test.address]).toBe(1);
	});

	it('replaces widgets after source edits and removes them when the directive is deleted', async () => {
		const test = await setup();
		test.codeBlock.code[2] = '; @switch &gate 0 7';
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', test.codeBlock);
		test.press();
		expect(test.write).toHaveBeenLastCalledWith(test.address, 7, true);
		test.codeBlock.code[2] = '; no widget';
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', test.codeBlock);
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		test.write.mockClear();
		test.press();
		expect(test.write).not.toHaveBeenCalled();
	});

	it('recomputes geometry when font dimensions change', async () => {
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
	});

	it('resolves cross-module memory references through the core memory API', async () => {
		const test = await setup([
			'module controls',
			'int gate 0',
			'; @switch &other:gate',
			'moduleEnd',
			'module other',
			'int gate 0',
			'moduleEnd',
		]);
		const address = test.state.compiler.memoryPlan.modules.other.memory.gate.allocationUnitAddress;
		test.press();
		expect(test.write).toHaveBeenLastCalledWith(address, 1, true);
		expect(test.memoryViews.int32[test.address]).toBe(0);
	});

	it('rebinds after runtime memory metadata changes and drops unresolved widgets', async () => {
		const test = await setup();
		const memory = test.state.compiler.memoryPlan.modules.controls.memory;
		memory.gate = { ...memory.gate, allocationUnitAddress: test.address + 4 };
		test.events.dispatch('runtimeInitialized');
		test.press();
		expect(test.write).toHaveBeenLastCalledWith(test.address + 4, 1, true);
		delete memory.gate;
		test.events.dispatch('runtimeInitialized');
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
	});

	it.each(['; @switch &missing', '; @switch &gate bad', 'int extra 0 ; @switch &gate'])(
		'creates no widget for unresolved, invalid, or unsupported trailing directives: %s',
		async line => {
			const test = await setup(['module controls', 'int gate 0', line, 'moduleEnd']);
			test.render();
			test.press();
			expect(test.draw.drawFill).not.toHaveBeenCalled();
			expect(test.draw.drawText).not.toHaveBeenCalled();
			expect(test.write).not.toHaveBeenCalled();
		}
	);

	it('leaves the generic parsed directive in core when the plugin is omitted', async () => {
		const test = await setup(source, false);
		expect(test.codeBlock.parsedDirectives).toContainEqual(
			expect.objectContaining({ name: 'switch', args: ['&gate'] })
		);
		test.render();
		test.press();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		expect(test.write).not.toHaveBeenCalled();
	});

	it('unregisters its directive, press handler, and drawer on disposal', async () => {
		const test = await setup();
		test.disposePlugin();
		test.render();
		test.press();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		expect(test.write).not.toHaveBeenCalled();
	});

	it('keeps widget data and registrations independent across editor instances', async () => {
		const first = await setup();
		const second = await setup();
		first.press();
		expect(first.memoryViews.int32[first.address]).toBe(1);
		expect(second.memoryViews.int32[second.address]).toBe(0);
		first.disposePlugin();
		second.press();
		second.render();
		expect(second.memoryViews.int32[second.address]).toBe(1);
		expect(second.draw.drawText).toHaveBeenCalledWith(
			second.codeBlock.width - 32,
			32,
			'[ |]',
			PALETTE_INDICES.darkBase
		);
	});
});
