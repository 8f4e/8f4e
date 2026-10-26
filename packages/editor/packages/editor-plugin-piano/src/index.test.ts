import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { PALETTE_INDICES } from '@8f4e/editor-palette';
import initState, { gapCalculator } from '@8f4e/editor-state';
import { createMockSpriteLookups } from '@8f4e/editor-state-testing';
import { createCodeBlockDrawerRegistry, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvents } from './__tests__/events';
import { createDrawContextMock } from './__tests__/rendering';
import { pianoPlugin } from './index';

const cleanups: Array<() => void> = [];
const source = ['module controls', 'int[] notes 4', 'int count 0', '; @piano &notes &count 48', 'moduleEnd'];

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
			loadSession: async () => null,
			getWordFromMemory: address => memoryViews.int32[address],
			setWordInMemory: write,
		},
	});
	const drawers = createCodeBlockDrawerRegistry();
	const dispose = installed
		? pianoPlugin.setup({ store, events, menus: store.menus, directives: store.directives, drawers })
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
	state.spriteLookups = createMockSpriteLookups() as never;
	const codeBlock = state.codeBlockRendering.codeBlocks.find(block => block.name === name)!;
	const draw = createDrawContextMock();
	const render = () => {
		vi.mocked(draw.drawFill).mockClear();
		vi.mocked(draw.drawText).mockClear();
		drawers.drawCodeBlock({ draw, state, codeBlock, memoryViews });
	};
	const point = (key = 0, sourceLineIndex = 3) => {
		const row = codeBlock.displayModel.sourceLineIndexToDisplayRow[sourceLineIndex]!;
		return {
			x: codeBlock.x + key * 2 * state.viewport.vGrid - state.viewport.x + 1,
			y: codeBlock.y + (gapCalculator(row, codeBlock.gaps) + 1) * state.viewport.hGrid - state.viewport.y + 1,
		};
	};
	const press = (key = 0, line = 3) => events.dispatch('codeBlockPointerDown', { codeBlock, ...point(key, line) });
	const click = (key = 0, line = 3) => {
		events.dispatch('mousedown', {
			...point(key, line),
			movementX: 0,
			movementY: 0,
			buttons: 1,
			altKey: false,
			canvasWidth: 800,
			canvasHeight: 600,
			stopPropagation: false,
		});
		events.dispatch('mouseup');
	};
	const initialRevision = state.compilerInputRevision;
	const menuItems = async () => {
		events.dispatch('openSubMenu', { menu: 'moduleMenu', codeBlock });
		await Promise.resolve();
		await Promise.resolve();
		return state.contextMenu.items.filter(item => item.action === 'savePianoValuesToCode');
	};
	return {
		initialRevision,
		store,
		state,
		events,
		codeBlock,
		compiled,
		memoryViews,
		draw,
		render,
		write,
		point,
		press,
		click,
		menuItems,
		dispose,
	};
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

describe('piano plugin', () => {
	it('reserves six rows, requires enough width, and draws 24 keys with note labels', async () => {
		const test = await setup();
		expect(test.codeBlock.gaps.get(3)).toEqual({ size: 6 });
		expect(test.codeBlock.minGridWidth).toBe(48);
		expect(test.codeBlock.width).toBeGreaterThanOrEqual(48 * test.state.viewport.vGrid);
		test.render();
		expect(test.draw.startGroup).toHaveBeenCalledWith(0, 64);
		expect(test.draw.drawFill).toHaveBeenCalledWith(0, 16, PALETTE_INDICES.lightBase, 16, 80);
		expect(test.draw.drawFill).toHaveBeenCalledWith(16, 16, PALETTE_INDICES.darkBase, 16, 48);
		expect(test.draw.drawText).toHaveBeenCalledWith(0, 0, 'C', PALETTE_INDICES.inkBase);
		expect(vi.mocked(test.draw.drawText).mock.calls.filter(call => call[2] !== ';;')).toHaveLength(24);
	});
	it('toggles notes from real pointer events and draws current runtime highlights', async () => {
		const test = await setup([...source.slice(0, -1), '; @pos 40 20', 'moduleEnd']);
		const original = [...test.codeBlock.code];
		const memory = test.compiled.memoryPlan.modules.controls.memory;
		test.click(2);
		expect(test.memoryViews.int32[memory.notes.allocationUnitAddress]).toBe(50);
		expect(test.memoryViews.int32[memory.count.allocationUnitAddress]).toBe(1);
		test.render();
		expect(test.draw.drawText).toHaveBeenCalledWith(32, 16, ';;', PALETTE_INDICES.darkOverlaySoft);
		test.press(2);
		expect(test.memoryViews.int32[memory.count.allocationUnitAddress]).toBe(0);
		expect(test.codeBlock.code).toEqual(original);
	});
	it('compacts integer notes and saves the remaining note after a real pointer click', async () => {
		const test = await setup([
			'module controls',
			'int[] notes 4 50 52',
			'int count 2',
			'; @piano &notes &count 48',
			'; @pos 40 20',
			'moduleEnd',
		]);
		const memory = test.compiled.memoryPlan.modules.controls.memory;
		test.memoryViews.int32.set([50, 52], memory.notes.allocationUnitAddress);
		test.memoryViews.int32[memory.count.allocationUnitAddress] = 2;
		test.render();
		for (const x of [32, 64]) {
			expect(test.draw.drawText).toHaveBeenCalledWith(x, 16, ';;', PALETTE_INDICES.darkOverlaySoft);
		}

		test.click(2);
		expect(test.memoryViews.int32[memory.notes.allocationUnitAddress]).toBe(52);
		expect(test.memoryViews.int32[memory.count.allocationUnitAddress]).toBe(1);
		expect(test.write).toHaveBeenCalledWith(memory.notes.allocationUnitAddress, 52, true);
		test.events.dispatch('savePianoValuesToCode', { codeBlock: test.codeBlock });
		expect(test.codeBlock.code).toContain('int[] notes 4 52');
		expect(test.codeBlock.code).toContain('int count 1');
	});
	it.each(['float', 'float64'] as const)('rejects %s note arrays before drawing, clicking, or saving', async type => {
		const test = await setup([
			'module controls',
			`${type}[] notes 4 50.0 52.0`,
			'int count 2',
			'; @piano &notes &count 48',
			'; @pos 40 20',
			'moduleEnd',
		]);
		const memory = test.compiled.memoryPlan.modules.controls.memory;
		const notes = type === 'float64' ? test.memoryViews.float64 : test.memoryViews.float32;
		notes.set([50, 52], memory.notes.byteAddress / notes.BYTES_PER_ELEMENT);
		test.memoryViews.int32[memory.count.allocationUnitAddress] = 2;
		const originalMemory = test.memoryViews.int32.slice();
		const originalCode = [...test.codeBlock.code];
		test.render();
		test.click(2);
		test.events.dispatch('savePianoValuesToCode', { codeBlock: test.codeBlock });

		expect(test.draw.drawFill).not.toHaveBeenCalled();
		expect(test.draw.drawText).not.toHaveBeenCalled();
		expect(test.write).not.toHaveBeenCalled();
		expect(test.memoryViews.int32).toEqual(originalMemory);
		expect(test.codeBlock.code).toEqual(originalCode);
		expect(test.state.compilerInputRevision).toBe(test.initialRevision);
		expect(await test.menuItems()).toEqual([]);
	});
	it.each(['float count 0.0', 'float64 count 0.0', 'int[] count 2'])(
		'rejects an unsupported count declaration: %s',
		async declaration => {
			const test = await setup(source.map(line => line.replace('int count 0', declaration)));
			test.render();
			test.press(2);
			expect(test.draw.drawFill).not.toHaveBeenCalled();
			expect(test.write).not.toHaveBeenCalled();
			expect(await test.menuItems()).toEqual([]);
		}
	);
	it('lays out multiple keyboards after earlier spacing requests', async () => {
		const test = await setup([...source.slice(0, -1), '; @piano &notes &count 60', 'moduleEnd']);
		test.render();
		expect(test.draw.startGroup).toHaveBeenCalledWith(0, 64);
		expect(test.draw.startGroup).toHaveBeenCalledWith(0, 176);
		test.press(0, 4);
		expect(test.memoryViews.int32[test.compiled.memoryPlan.modules.controls.memory.notes.allocationUnitAddress]).toBe(
			60
		);
	});
	it('updates source positions and clears data and minimum width when a directive is removed', async () => {
		const test = await setup();
		test.codeBlock.code.splice(3, 0, '; note');
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', test.codeBlock);
		test.render();
		expect(test.draw.startGroup).toHaveBeenCalledWith(0, 80);
		test.codeBlock.code = test.codeBlock.code.filter(line => !line.includes('@piano'));
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', test.codeBlock);
		test.render();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		expect(test.codeBlock.minGridWidth).toBeUndefined();
		expect(test.codeBlock.gaps.size).toBe(0);
		expect(await test.menuItems()).toEqual([]);
	});
	it('does not draw or interact when memory cannot be resolved', async () => {
		const test = await setup(source.map(line => line.replace('&notes', '&missing')));
		test.render();
		test.press();
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		expect(test.write).not.toHaveBeenCalled();
	});
	it('maps keys correctly with a shifted viewport', async () => {
		const test = await setup();
		test.state.viewport.x = 27;
		test.state.viewport.y = 39;
		test.press(23);
		expect(test.memoryViews.int32[test.compiled.memoryPlan.modules.controls.memory.notes.allocationUnitAddress]).toBe(
			71
		);
	});
	it('saves notes and count through its own menu action and advances compilation once', async () => {
		const test = await setup();
		test.press(2);
		test.press(4);
		const item = (await test.menuItems())[0];
		expect(item).toMatchObject({
			title: expect.stringContaining('Save piano values to code'),
			action: 'savePianoValuesToCode',
			payload: { codeBlock: test.codeBlock },
			disabled: false,
		});
		test.events.dispatch(item.action!, item.payload);
		expect(test.codeBlock.code).toContain('int[] notes 4 50 52');
		expect(test.codeBlock.code).toContain('int count 2');
		expect(test.state.compilerInputRevision).toBe(test.initialRevision + 1);
		test.events.dispatch(item.action!, item.payload);
		expect(test.state.compilerInputRevision).toBe(test.initialRevision + 1);
	});
	it('uses the selected block when saving without an explicit target', async () => {
		const test = await setup();
		test.press(0);
		test.state.codeBlockRendering.selectedCodeBlock = test.codeBlock;
		test.events.dispatch('savePianoValuesToCode');
		expect(test.codeBlock.code).toContain('int[] notes 4 48');
	});
	it('consumes a save-menu click over a key without toggling another runtime note', async () => {
		const test = await setup([...source.slice(0, -1), '; @pos 40 20', 'moduleEnd']);
		test.press(2);
		const item = (await test.menuItems())[0];
		test.state.contextMenu.items = [item];
		test.state.contextMenu.highlightedItem = 0;
		test.state.contextMenu.open = true;
		const click = { ...test.point(), buttons: 1, altKey: false, stopPropagation: false };
		test.events.dispatch('mousedown', click);
		expect(click.stopPropagation).toBe(true);
		expect(test.state.contextMenu.open).toBe(false);
		expect(test.codeBlock.code).toContain('int[] notes 4 50');
		expect(test.memoryViews.int32[test.compiled.memoryPlan.modules.controls.memory.count.allocationUnitAddress]).toBe(
			1
		);
	});
	it('hides saving in view mode and disables saving without memory access', async () => {
		const test = await setup();
		test.press(0);
		test.state.featureFlags.editing = false;
		expect(await test.menuItems()).toEqual([]);
		test.events.dispatch('savePianoValuesToCode', { codeBlock: test.codeBlock });
		expect(test.state.compilerInputRevision).toBe(test.initialRevision);
		test.state.featureFlags.editing = true;
		test.state.callbacks.getWordFromMemory = undefined;
		expect((await test.menuItems())[0].disabled).toBe(true);
	});
	it('resolves group exposures, interacts, and saves notes and count into different owners', async () => {
		const test = await setup(
			[
				'group audio',
				'expose keys &notesData:notes',
				'expose pressed &countData:count',
				'; @piano &keys &pressed 48',
				'module notesData',
				'int[] notes 4',
				'moduleEnd',
				'module countData',
				'int count 0',
				'moduleEnd',
				'groupEnd',
			],
			true,
			'audio'
		);
		test.press(2);
		test.press(4);
		test.render();
		expect(test.draw.drawText).toHaveBeenCalledWith(32, 16, ';;', PALETTE_INDICES.darkOverlaySoft);
		test.events.dispatch('savePianoValuesToCode', { codeBlock: test.codeBlock });
		expect(test.codeBlock.nestedProjectCodeBlocks!.find(block => block.name === 'notesData')!.code).toContain(
			'int[] notes 4 50 52'
		);
		expect(test.codeBlock.nestedProjectCodeBlocks!.find(block => block.name === 'countData')!.code).toContain(
			'int count 2'
		);
		expect(test.codeBlock.code).toContain('expose keys &notesData:notes');
		expect(test.state.compilerInputRevision).toBe(test.initialRevision + 1);
	});
	it('omits the feature without installation and keeps editor instances isolated', async () => {
		const first = await setup();
		const second = await setup();
		const bare = await setup(source, false);
		first.press(2);
		second.render();
		bare.render();
		bare.press(2);
		expect(second.write).not.toHaveBeenCalled();
		expect(vi.mocked(second.draw.drawText).mock.calls.some(call => call[2] === ';;')).toBe(false);
		expect(bare.draw.drawFill).not.toHaveBeenCalled();
		expect(bare.write).not.toHaveBeenCalled();
		expect(bare.codeBlock.minGridWidth).toBeUndefined();
		expect(bare.codeBlock.gaps.size).toBe(0);
		expect(await bare.menuItems()).toEqual([]);
	});
	it('unregisters drawing, interaction, menu actions, and directive layout on disposal', async () => {
		const test = await setup();
		test.dispose();
		test.render();
		test.press(2);
		test.events.dispatch('savePianoValuesToCode', { codeBlock: test.codeBlock });
		expect(test.draw.drawFill).not.toHaveBeenCalled();
		expect(test.write).not.toHaveBeenCalled();
		expect(await test.menuItems()).toEqual([]);
		expect(test.state.compilerInputRevision).toBe(test.initialRevision);
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', test.codeBlock);
		expect(test.codeBlock.gaps.size).toBe(0);
		expect(test.codeBlock.minGridWidth).toBeUndefined();
	});
});
