import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState, { gapCalculator } from '@8f4e/editor-state';
import { createCodeBlockDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { createDrawContextMock } from './__tests__/rendering';
import { createSliderPlugin } from './index';

const cleanups: Array<() => void> = [];
const source = ['module controls', 'float gain 0.25', '; @slider &gain 0 1 0.01', '; @pos 40 20', 'moduleEnd'];

async function setup(code = source, installed = true, name = 'controls') {
	const project = parseProjectSource(['8f4e/v1', 'entry main', ...code, 'entryEnd'].join('\n'));
	const compiled = await compileProject(project, { disableSharedMemory: true });
	const buffer = new ArrayBuffer(65536);
	const memoryViews: MemoryViews = {
		int8: new Int8Array(buffer),
		uint8: new Uint8Array(buffer),
		int16: new Int16Array(buffer),
		uint16: new Uint16Array(buffer),
		int32: new Int32Array(buffer),
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
		},
	});
	const drawers = createCodeBlockDrawerRegistry();
	const dispose = installed
		? createSliderPlugin({ writeMemory: write }).setup({
				store,
				events,
				menus: store.menus,
				directives: store.directives,
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
	const block = state.codeBlockRendering.codeBlocks.find(block => block.name === name)!;
	const initialRevision = state.compilerInputRevision;
	const draw = createDrawContextMock();
	const render = () => {
		vi.mocked(draw.drawFill).mockClear();
		vi.mocked(draw.drawText).mockClear();
		vi.mocked(draw.startGroup).mockClear();
		drawers.drawCodeBlock({ draw, state, codeBlock: block, memoryViews });
	};
	const point = (position = 0.5, sourceLineIndex = 2) => {
		const x = (block.lineNumberColumnWidth + 2) * state.viewport.vGrid;
		const width = block.width - x;
		const row = block.displayModel.sourceLineIndexToDisplayRow[sourceLineIndex]!;
		return {
			x: block.x + x + position * width - state.viewport.x,
			y: block.y + (gapCalculator(row, block.gaps) + 1) * state.viewport.hGrid - state.viewport.y + 1,
		};
	};
	const press = (position = 0.5, row = 2) =>
		events.dispatch('codeBlockPointerDown', { codeBlock: block, ...point(position, row) });
	const move = (position: number) => {
		const event = {
			...point(position),
			movementX: 20,
			movementY: 10,
			buttons: 1,
			altKey: false,
			stopPropagation: false,
		};
		events.dispatch('mousemove', event);
		return event;
	};
	const release = () => events.dispatch('mouseup');
	const menuItems = async () => {
		events.dispatch('openSubMenu', { menu: 'moduleMenu', payload: { codeBlock: block } });
		await Promise.resolve();
		await Promise.resolve();
		return state.contextMenu.items.filter(item => item.action === 'saveSliderValuesToCode');
	};
	return {
		state,
		store,
		block,
		compiled,
		initialRevision,
		memoryViews,
		events,
		drawers,
		draw,
		write,
		render,
		point,
		press,
		move,
		release,
		menuItems,
		dispose,
	};
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

describe('slider plugin', () => {
	it('reserves two rows and draws current runtime values with a two-row handle', async () => {
		const test = await setup();
		const memory = test.compiled.memoryPlan.modules.controls.memory.gain;
		test.memoryViews.float32[memory.allocationUnitAddress] = 0.5;
		test.render();
		expect(test.block.gaps.get(2)).toEqual({ size: 2 });
		const x = (test.block.lineNumberColumnWidth + 2) * test.state.viewport.vGrid;
		expect(test.draw.startGroup).toHaveBeenCalledWith(x, 48);
		expect(test.draw.drawFill).toHaveBeenCalledWith(0, 0, PALETTE_INDICES.surfaceRaised2, test.block.width - x, 32);
		expect(vi.mocked(test.draw.drawText).mock.calls.map(call => call[1])).toEqual([0, 16]);
	});
	it.each([true, false])(
		'drags through pointer events without moving blocks or viewport, editing=%s',
		async editing => {
			const test = await setup();
			test.store.set('featureFlags.editing', editing);
			const original = [...test.block.code];
			const viewport = { x: test.state.viewport.x, y: test.state.viewport.y };
			const blockPosition = { x: test.block.x, y: test.block.y };
			test.events.dispatch('mousedown', { ...test.point(0.25), buttons: 1, altKey: false, stopPropagation: false });
			expect(test.state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
			expect(test.move(0.75).stopPropagation).toBe(true);
			expect(test.write).toHaveBeenLastCalledWith(
				test.compiled.memoryPlan.modules.controls.memory.gain.allocationUnitAddress,
				0.75,
				false
			);
			expect({ x: test.state.viewport.x, y: test.state.viewport.y }).toEqual(viewport);
			expect({ x: test.block.x, y: test.block.y }).toEqual(blockPosition);
			expect(test.block.code).toEqual(original);
			expect(test.state.compilerInputRevision).toBe(test.initialRevision);
			test.release();
			test.write.mockClear();
			test.move(0.5);
			expect(test.write).not.toHaveBeenCalled();
		}
	);
	it('clamps dragging outside the control and snaps to the declared step', async () => {
		const test = await setup(
			source.map(line => line.replace('float gain 0.25', 'int gain 0').replace('0 1 0.01', '-100 100 5'))
		);
		test.press(0.47);
		expect(test.write).toHaveBeenLastCalledWith(expect.any(Number), -5, true);
		test.move(-1);
		expect(test.write).toHaveBeenLastCalledWith(expect.any(Number), -100, true);
		test.move(2);
		expect(test.write).toHaveBeenLastCalledWith(expect.any(Number), 100, true);
	});
	it('gives an open context menu pointer movement before an active slider drag', async () => {
		const test = await setup();
		test.events.dispatch('mousedown', { ...test.point(0.25), buttons: 1, altKey: false, stopPropagation: false });
		test.events.dispatch('contextmenu', { ...test.point(0.25), buttons: 3, stopPropagation: false });
		await Promise.resolve();
		await Promise.resolve();
		expect(test.state.contextMenu.open).toBe(true);
		test.write.mockClear();
		const move = {
			x: test.state.contextMenu.x - test.state.viewport.x + 1,
			y: test.state.contextMenu.y - test.state.viewport.y + test.state.viewport.hGrid + 1,
			movementX: 0,
			movementY: 16,
			buttons: 3,
			altKey: false,
			stopPropagation: false,
		};
		test.events.dispatch('mousemove', move);
		expect(test.state.contextMenu.highlightedItem).toBe(1);
		expect(move.stopPropagation).toBe(true);
		expect(test.write).not.toHaveBeenCalled();
	});
	it.each([
		{ type: 'int', max: 127, integer: true },
		{ type: 'float', max: 1, integer: false },
	])('uses the default range for $type storage', async ({ type, max, integer }) => {
		const test = await setup(['module controls', `${type} gain 0`, '; @slider &gain', '; @pos 40 20', 'moduleEnd']);
		test.press(1);
		expect(test.write).toHaveBeenLastCalledWith(expect.any(Number), max, integer);
	});
	it('preserves supplied range bounds when only the upper bound is omitted', async () => {
		const test = await setup(['module controls', 'float gain 0', '; @slider &gain -1', '; @pos 40 20', 'moduleEnd']);
		test.press(0);
		expect(test.write).toHaveBeenLastCalledWith(expect.any(Number), -1, false);
		test.press(1);
		expect(test.write).toHaveBeenLastCalledWith(expect.any(Number), 1, false);
	});
	it('places multiple sliders after preceding spacing and reacts to source edits', async () => {
		const test = await setup([...source.slice(0, -1), '; @slider &gain 0 2', 'moduleEnd']);
		test.render();
		expect(vi.mocked(test.draw.startGroup).mock.calls.map(call => call[1])).toEqual([48, 112]);
		test.press(1, 4);
		expect(test.write).toHaveBeenLastCalledWith(expect.any(Number), 2, false);
		test.block.code = test.block.code.filter(line => !line.includes('@slider'));
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', test.block);
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		expect(test.block.gaps.size).toBe(0);
		expect(await test.menuItems()).toEqual([]);
	});
	it('ignores unresolved memory and points outside a slider', async () => {
		const unresolved = await setup(source.map(line => line.replace('&gain', '&missing')));
		unresolved.render();
		unresolved.press();
		expect(unresolved.draw.drawFill).not.toHaveBeenCalled();
		expect(unresolved.write).not.toHaveBeenCalled();
		const test = await setup();
		test.events.dispatch('codeBlockPointerDown', { codeBlock: test.block, x: -100, y: -100 });
		expect(test.write).not.toHaveBeenCalled();
	});
	it('hit-tests with a shifted viewport', async () => {
		const test = await setup();
		test.state.viewport.x = 27;
		test.state.viewport.y = 39;
		test.press(0.75);
		expect(test.write).toHaveBeenLastCalledWith(expect.any(Number), 0.75, false);
	});
	it('saves through its menu target, publishes source edits, and advances compilation only for changes', async () => {
		const test = await setup();
		test.press(0.7);
		const projectRevision = test.state.projectRevision;
		const item = (await test.menuItems())[0];
		expect(item).toMatchObject({
			title: expect.stringContaining('Save slider values to code'),
			payload: { codeBlock: test.block },
			disabled: false,
		});
		const observed: string[][] = [];
		test.store.subscribe('compilerInputRevision', () => observed.push([...test.block.code]));
		test.state.codeBlockRendering.selectedCodeBlock = undefined;
		test.events.dispatch(item.action!, item.payload);
		expect(test.block.code).toContain('float gain 0.7');
		expect(test.state.compilerInputRevision).toBe(test.initialRevision + 1);
		expect(test.state.projectRevision).toBe(projectRevision + 1);
		expect(observed).toEqual([test.block.code]);
		test.events.dispatch(item.action!, item.payload);
		expect(test.state.compilerInputRevision).toBe(test.initialRevision + 1);
		expect(test.state.projectRevision).toBe(projectRevision + 1);
	});
	it('uses the selected block for a save action without a target', async () => {
		const test = await setup();
		test.press(0.5);
		test.state.codeBlockRendering.selectedCodeBlock = test.block;
		test.events.dispatch('saveSliderValuesToCode');
		expect(test.block.code).toContain('float gain 0.5');
	});
	it('hides saving in view mode and disables it without readable memory', async () => {
		const test = await setup();
		test.press();
		test.state.featureFlags.editing = false;
		expect(await test.menuItems()).toEqual([]);
		test.events.dispatch('saveSliderValuesToCode', { codeBlock: test.block });
		expect(test.state.compilerInputRevision).toBe(test.initialRevision);
		test.state.featureFlags.editing = true;
		test.state.callbacks.getWordFromMemory = undefined;
		expect((await test.menuItems())[0].disabled).toBe(true);
	});
	it('resolves group aliases to their backing storage and saves into the original module', async () => {
		const test = await setup(
			[
				'group audio',
				'expose gain &voice:level',
				'; @slider &gain 0 1 0.01',
				'; @pos 40 20',
				'module voice',
				'float level 0.25',
				'moduleEnd',
				'groupEnd',
			],
			true,
			'audio'
		);
		const original = [...test.block.code];
		test.press(0.8);
		test.release();
		expect(
			test.memoryViews.float32[test.compiled.memoryPlan.modules['audio/voice'].memory.level.allocationUnitAddress]
		).toBeCloseTo(0.8);
		test.events.dispatch('saveSliderValuesToCode', { codeBlock: test.block });
		expect(test.block.nestedProjectCodeBlocks!.find(block => block.name === 'voice')!.code).toContain(
			'float level 0.8'
		);
		expect(test.block.code).toEqual(original);
		expect(test.state.compilerInputRevision).toBe(test.initialRevision + 1);
	});
	it('rebinds to replacement compiler metadata and drops unresolved aliases', async () => {
		const test = await setup(
			[
				'group audio',
				'expose gain &voice:level',
				'; @slider &gain',
				'; @pos 40 20',
				'module voice',
				'float level 0.25',
				'moduleEnd',
				'module other',
				'int level 0',
				'moduleEnd',
				'groupEnd',
			],
			true,
			'audio'
		);
		const target = test.compiled.memoryPlan.modules['audio/other'].memory.level;
		test.store.set('compiler.projectMemoryExposuresByGroupPath', {
			audio: [
				{
					...test.compiled.projectMemoryExposuresByGroupPath.audio[0],
					targetModuleId: 'audio/other',
					targetMemory: target,
				},
			],
		});
		test.store.set('compiler.isCompiling', false);
		test.press(1);
		expect(test.write).toHaveBeenLastCalledWith(target.allocationUnitAddress, 127, true);
		test.store.set('compiler.projectMemoryExposuresByGroupPath', {});
		test.store.set('compiler.isCompiling', false);
		test.write.mockClear();
		test.render();
		test.press();
		expect(test.write).not.toHaveBeenCalled();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
	});
	it('reads and saves float64 values from live memory', async () => {
		const test = await setup(source.map(line => line.replace('float gain 0.25', 'float64 gain 0.0')));
		const memory = test.compiled.memoryPlan.modules.controls.memory.gain;
		test.memoryViews.float64[memory.byteAddress / 8] = 0.75;
		test.render();
		expect(test.draw.drawFill).toHaveBeenCalled();
		test.events.dispatch('saveSliderValuesToCode', { codeBlock: test.block });
		expect(test.block.code).toContain('float64 gain 0.75');
	});
	it('keeps editor instances isolated and omits the feature without installation', async () => {
		const first = await setup();
		const second = await setup();
		const bare = await setup(source, false);
		first.press(0.8);
		expect(second.write).not.toHaveBeenCalled();
		bare.press();
		bare.render();
		expect(bare.write).not.toHaveBeenCalled();
		expect(bare.draw.drawFill).not.toHaveBeenCalled();
		expect(bare.block.gaps.size).toBe(0);
		expect(await bare.menuItems()).toEqual([]);
	});
	it('disposes an active drag, directive, drawer, and save action', async () => {
		const test = await setup();
		test.press();
		test.dispose();
		test.write.mockClear();
		test.move(0.8);
		test.press(0.8);
		test.render();
		test.events.dispatch('saveSliderValuesToCode', { codeBlock: test.block });
		expect(test.write).not.toHaveBeenCalled();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		expect(await test.menuItems()).toEqual([]);
		expect(test.state.compilerInputRevision).toBe(test.initialRevision);
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', test.block);
		expect(test.block.gaps.size).toBe(0);
	});
});
